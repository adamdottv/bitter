import {
  GraphqlApi,
  AuthorizationType,
  Schema,
  DynamoDbDataSource,
  NoneDataSource,
  BaseDataSource,
  MappingTemplate,
  AppsyncFunction,
  IAppsyncFunction,
  Resolver,
} from "@aws-cdk/aws-appsync-alpha"
import {
  CfnOutput,
  Duration,
  Stack,
  StackProps,
  PhysicalName,
} from "aws-cdk-lib"
import {
  EndpointType,
  RestApi,
  DomainName,
  HttpIntegration,
} from "aws-cdk-lib/aws-apigateway"
import {
  EventSourceMapping,
  StartingPosition,
  Runtime,
  Architecture,
} from "aws-cdk-lib/aws-lambda"
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs"
import { Construct } from "constructs"
import { existsSync, readFileSync } from "fs"
import { basename, parse, join } from "path"
import {
  ICertificate,
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager"
import {
  ITable,
  Table,
  BillingMode,
  AttributeType,
  StreamViewType,
} from "aws-cdk-lib/aws-dynamodb"
import { ServicePrincipal } from "aws-cdk-lib/aws-iam"
import { IHostedZone, HostedZone, CfnRecordSet } from "aws-cdk-lib/aws-route53"
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager"
import * as glob from "fast-glob"
import {
  GithubActionsIdentityProvider,
  GithubActionsRole,
  IGithubActionsIdentityProvider,
} from "aws-cdk-github-oidc"

const vtlRequestMappingTemplatePaths = glob.sync("lib/**/*.req.vtl")

export interface ApiStackProps extends StackProps {
  prod: boolean
  main: boolean
  scope?: string
  domainName: string
  hostedZoneName: string
  hostedZoneId: string
  certificateArn?: string
  secretArn?: string
  region: string
  regions?: string[]
}

export class ApiStack extends Stack {
  readonly table: ITable
  readonly api: GraphqlApi
  readonly apiCertificate: ICertificate
  readonly apiProxy: RestApi
  readonly zone?: IHostedZone
  readonly authSecret: ISecret

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const { prod, main, hostedZoneName, hostedZoneId, certificateArn } = props

    this.authSecret = Secret.fromSecretNameV2(this, "AuthSecret", "bitter")
    this.table = this.createTable(props)
    this.api = this.createApi(this.table)

    if (prod) {
      // Using the hosted zone we created with the AWS console
      this.zone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        zoneName: hostedZoneName,
        hostedZoneId,
      })

      this.apiCertificate = this.createCertificate(
        props,
        this.zone,
        certificateArn
      )
      this.apiProxy = this.createApiProxy(props, this.api, this.apiCertificate)
      this.createDnsRecord(props, this.apiProxy.domainName as DomainName)

      new CfnOutput(this, "GraphqlApiUrl", {
        exportName: "GlobalApiUrl",
        value: `https://${props.domainName}/graphql`,
        description: "The global API URL.",
      })
    }

    if (main) this.createStreamListener()

    let provider: IGithubActionsIdentityProvider | undefined = undefined
    if (prod && main) {
      provider = new GithubActionsIdentityProvider(this, "GithubProvider")
    } else {
      provider = GithubActionsIdentityProvider.fromAccount(
        this,
        "GithubProvider"
      )
    }

    const actionsRole = new GithubActionsRole(this, "GithubActionsRole", {
      provider, // reference into the OIDC provider
      owner: "adamelmore", // your repository owner (organization or user) name
      repo: "bitter", // your repository name (without the owner name)
    })

    new CfnOutput(this, "GithubActionsRoleArn", {
      value: actionsRole.roleArn,
      description: "GitHub Actions Role ARN",
    })

    new CfnOutput(this, "RegionalGraphqlApiUrl", {
      exportName: "RegionalApiUrl",
      value: this.api.graphqlUrl,
      description: "The regional API URL.",
    })

    new CfnOutput(this, "ApiRegion", {
      description: "API primary AWS region",
      value: this.region,
    })

    new CfnOutput(this, "TableName", {
      description: "DynamoDB table name.",
      value: this.table.tableName,
    })
  }

  createStreamListener() {
    const streamListener = new NodejsFunction(this, "StreamListener", {
      description: "DynamoDB stream listener",
      runtime: Runtime.NODEJS_16_X,
      architecture: Architecture.ARM_64,
      entry: "lib/functions/stream-listener.ts",
      memorySize: 256,
      timeout: Duration.minutes(15),
      environment: { TABLE_NAME: this.table.tableName },
      bundling: {
        format: OutputFormat.ESM,
        tsconfig: "lib/functions/tsconfig.json",
        /* target: "node14.8", */
        nodeModules: [
          "@aws-sdk/client-secrets-manager",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "@aws-sdk/util-dynamodb",
        ],
      },
    })

    this.table.grantStreamRead(streamListener)
    this.table.grantReadWriteData(streamListener)

    new EventSourceMapping(this, "EventSourceMapping", {
      target: streamListener,
      eventSourceArn: this.table.tableStreamArn,
      startingPosition: StartingPosition.TRIM_HORIZON,
      batchSize: 1000,
    })

    // Escape hatch here to add an event source filter so that our
    // function isn't invoked on updates (we only care about inserts and deletes).
    // const cfnDynamoEventSourceMapping = dynamoEventSourceMapping.node
    //   .defaultChild as CfnEventSourceMapping
    // cfnDynamoEventSourceMapping.addPropertyOverride("FilterCriteria", {
    //   Filters: [{ Pattern: '{ "eventName" : [ "INSERT", "REMOVE" ] }' }],
    // })
  }

  createTable(props: ApiStackProps): ITable {
    const { main, regions, scope, prod } = props

    const tableName = `bitter-table${scope ? `-${scope}` : ""}`

    if (!main) {
      return Table.fromTableName(this, tableName, tableName)
    }

    const table = new Table(this, `Table`, {
      tableName,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      timeToLiveAttribute: "expires",
      replicationRegions: prod ? regions : undefined,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    })

    table.addGlobalSecondaryIndex({
      indexName: "gsi1",
      partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: AttributeType.STRING },
    })

    return table
  }

  createApi(table: ITable): GraphqlApi {
    const appsyncAuthorizer = new NodejsFunction(this, "AppsyncAuthorizer", {
      description: "AppSync custom authorizer",
      runtime: Runtime.NODEJS_14_X,
      architecture: Architecture.ARM_64,
      entry: "lib/functions/appsync-authorizer.ts",
      timeout: Duration.seconds(10),
      environment: {
        SECRET_ARN: this.authSecret.secretArn,
        TABLE_NAME: table.tableName,
      },
      bundling: {
        format: OutputFormat.ESM,
        tsconfig: "lib/functions/tsconfig.json",
        target: "node14.8",
        nodeModules: [
          "@aws-sdk/client-secrets-manager",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "next-auth",
        ],
      },
    })

    table.grantReadData(appsyncAuthorizer)
    this.authSecret.grantRead(appsyncAuthorizer)

    appsyncAuthorizer.addPermission("AppSync InvokeFunction Permission", {
      principal: new ServicePrincipal("appsync.amazonaws.com"),
      action: "lambda:InvokeFunction",
    })

    const api = new GraphqlApi(this, "GraphqlApi", {
      name: "GraphqlApi",
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.LAMBDA,
          lambdaAuthorizerConfig: {
            handler: appsyncAuthorizer,
            resultsCacheTtl: Duration.minutes(5),
          },
        },
      },
      schema: Schema.fromAsset("__generated__/schema.graphql"),
    })

    const dynamoDbDataSource = new DynamoDbDataSource(
      this,
      "DynamoDBDataSource",
      { api, table }
    )

    const noneDatasource = new NoneDataSource(this, "NoneDataSource", {
      api,
    })

    const dataSources: Record<string, BaseDataSource> = {
      DynamoDBDataSource: dynamoDbDataSource,
      NoneDataSource: noneDatasource,
    }

    const defaultResponseTemplateString = "$util.toJson($ctx.result)"
    const defaultResponseTemplate = MappingTemplate.fromString(
      defaultResponseTemplateString
    )
    const replacements: Record<string, string> = {
      TABLE_NAME: table.tableName,
    }
    const hydrateVtlTemplate = (
      templatePath: string
    ): [MappingTemplate, string] => {
      const templateExists = existsSync(templatePath)
      if (!templateExists) {
        if (templatePath.endsWith(".req.vtl")) {
          throw new Error("Request VTL template not found: " + templatePath)
        } else if (templatePath.endsWith(".res.vtl")) {
          return [defaultResponseTemplate, defaultResponseTemplateString]
        } else {
          throw new Error(
            `Unhandled VTL template file extention for path '${templatePath}'.`
          )
        }
      }

      const vtl = readFileSync(templatePath, { encoding: "utf-8" })
      let hydratedVtl = vtl.trim()
      for (const key in replacements) {
        const value = replacements[key]
        const regex = new RegExp(`\\[\\[\\s*${key}\\s*\\]\\]`, "g")
        hydratedVtl = hydratedVtl.replace(regex, value)
      }

      return [MappingTemplate.fromString(hydratedVtl), hydratedVtl]
    }

    const functions: Record<string, AppsyncFunction> = {}
    const extractPipelineConfig = (
      vtl: string
    ): IAppsyncFunction[] | undefined => {
      const requestVtlLines = vtl.split("\n")
      const pipelineConfigLine = requestVtlLines.find((l) =>
        l.trim().startsWith("## pipeline:")
      )
      const [, pipelineFunctionNames] = pipelineConfigLine?.split(":") || []
      const pipelineFunctions = pipelineFunctionNames
        ?.split(",")
        .map((fname) => functions[fname.trim()])
      return pipelineFunctions?.length > 0 ? pipelineFunctions : undefined
    }

    const extractDataSource = (vtl: string): BaseDataSource | undefined => {
      const requestVtlLines = vtl.split("\n")
      const dataSourceConfigLine = requestVtlLines.find((l) =>
        l.trim().startsWith("## dataSource:")
      )
      const [, dataSourceName] = dataSourceConfigLine?.split(":") || []
      return dataSources[dataSourceName?.trim()]
    }

    const functionPaths = vtlRequestMappingTemplatePaths.filter((p) =>
      basename(p).startsWith("Function.")
    )

    for (const requestVtlPath of functionPaths) {
      const { base, dir } = parse(requestVtlPath)
      const name = base.replace("Function.", "").replace(".req.vtl", "")
      const snakeCased = name.replace(/-/g, "_")
      const responseVtlPath = join(dir, `Function.${name}.res.vtl`)
      const [requestMappingTemplate, requestVtl] =
        hydrateVtlTemplate(requestVtlPath)
      const [responseMappingTemplate] = hydrateVtlTemplate(responseVtlPath)

      const dataSource =
        extractDataSource(requestVtl) ??
        // Alright, here me out. For some functions, we need a NoneDataSource. I haven't
        // come up with an example of a DynamoDB template that *doesn't* use the $util.dynamodb
        // utility at least once. So...
        (requestVtl.includes("dynamodb") ? dynamoDbDataSource : noneDatasource)

      const appsyncFunction = new AppsyncFunction(this, snakeCased, {
        name: snakeCased,
        api,
        dataSource,
        requestMappingTemplate,
        responseMappingTemplate,
      })

      functions[snakeCased] = appsyncFunction
    }

    const resolverPaths = vtlRequestMappingTemplatePaths.filter(
      (p) => !functionPaths.includes(p)
    )
    for (const requestVtlPath of resolverPaths) {
      const { base, dir } = parse(requestVtlPath)
      const [typeName, fieldName] = base.split(".")
      const name = `${typeName}.${fieldName}`

      const responseVtlPath = join(dir, `${name}.res.vtl`)
      const [requestMappingTemplate, requestVtl] =
        hydrateVtlTemplate(requestVtlPath)
      const [responseMappingTemplate] = hydrateVtlTemplate(responseVtlPath)
      const pipelineConfig = extractPipelineConfig(requestVtl)

      new Resolver(this, `${name} Resolver`, {
        api,
        dataSource: pipelineConfig ? undefined : dynamoDbDataSource,
        typeName,
        fieldName,
        pipelineConfig,
        requestMappingTemplate,
        responseMappingTemplate,
      })
    }

    /* const publishFunction = new NodejsFunction(this, "PublishFunction", { */
    /*   description: "Publishes a site version.", */
    /*   runtime: Runtime.NODEJS_16_X, */
    /*   architecture: Architecture.ARM_64, */
    /*   timeout: Duration.minutes(1), */
    /*   memorySize: 512, */
    /*   entry: "lib/functions/publish.ts", */
    /*   environment: { TABLE_NAME: table.tableName }, */
    /*   bundling: { */
    /*     format: OutputFormat.ESM, */
    /*     tsconfig: "lib/functions/tsconfig.json", */
    /*     /* target: "node14.8", */
    /*     nodeModules: [ */
    /*       "@aws-sdk/client-dynamodb", */
    /*       "@aws-sdk/lib-dynamodb", */
    /*       "ulid", */
    /*     ], */
    /*   }, */
    /* }) */

    /* table.grantReadWriteData(publishFunction) */

    /* const publishDataSource = new LambdaDataSource(this, "PublishDataSource", { */
    /*   api, */
    /*   lambdaFunction: publishFunction, */
    /* }) */
    /**/
    /* new Resolver(this, "Mutation.publish Resolver", { */
    /*   api, */
    /*   dataSource: publishDataSource, */
    /*   typeName: "Mutation", */
    /*   fieldName: "publish", */
    /* }) */

    return api
  }

  createCertificate(
    props: ApiStackProps,
    zone: IHostedZone,
    certificateArn?: string
  ): ICertificate {
    if (certificateArn)
      return Certificate.fromCertificateArn(this, "Certificate", certificateArn)

    return new Certificate(this, "Certificate", {
      domainName: props.domainName,
      validation: CertificateValidation.fromDns(zone),
    })
  }

  createApiProxy(
    props: ApiStackProps,
    api: GraphqlApi,
    certificate: ICertificate
  ): RestApi {
    const { domainName } = props

    const apiProxy = new RestApi(this, "ApiProxy", {
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      domainName: {
        domainName,
        certificate,
        endpointType: EndpointType.REGIONAL,
        basePath: "graphql",
      },
    })

    const responseTemplates = { "application/json": "" }
    const responseParameters = {
      "method.response.header.Content-Type": "'application/json'",
      "method.response.header.Access-Control-Allow-Origin":
        "'https://bitter.fyi'",
      "method.response.header.Access-Control-Allow-Credentials": "'true'",
    }
    const methodResponseParameters = {
      "method.response.header.Content-Type": true,
      "method.response.header.Access-Control-Allow-Origin": true,
      "method.response.header.Access-Control-Allow-Credentials": true,
    }

    apiProxy.root.addMethod(
      "POST",
      new HttpIntegration(api.graphqlUrl, {
        httpMethod: "POST",
        proxy: false,
        options: {
          requestParameters: {
            "integration.request.header.Authorization":
              "method.request.header.Cookie",
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates,
              responseParameters,
            },
            {
              selectionPattern: "40[13]",
              statusCode: "401",
              responseTemplates,
              responseParameters,
            },
            {
              selectionPattern: `4\d{2}`,
              statusCode: "400",
              responseTemplates,
              responseParameters,
            },
          ],
        },
      }),
      {
        requestParameters: {
          "method.request.header.Cookie": false,
        },
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: methodResponseParameters,
          },
          {
            statusCode: "401",
            responseParameters: methodResponseParameters,
          },
          {
            statusCode: "400",
            responseParameters: methodResponseParameters,
          },
        ],
      }
    )

    return apiProxy
  }

  createDnsRecord(props: ApiStackProps, customDomain: DomainName) {
    const { region, hostedZoneId, domainName } = props

    // CDK doesn't have a construct for geolocation or latency records
    // so we use a CFN resource
    new CfnRecordSet(this, "RecordSet", {
      type: "A",
      name: domainName,
      setIdentifier: "ApiRecordSet-" + region,
      hostedZoneId,
      region,
      aliasTarget: {
        dnsName: customDomain.domainNameAliasDomainName,
        hostedZoneId: customDomain.domainNameAliasHostedZoneId,
      },
    })
  }
}
