import { Stack, StackProps, Duration } from "aws-cdk-lib"
import { Construct } from "constructs"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { Rule, Schedule } from "aws-cdk-lib/aws-events"
import { Secret } from "aws-cdk-lib/aws-secretsmanager"
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs"
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda"
import { PolicyStatement } from "aws-cdk-lib/aws-iam"

interface TestStackProps extends StackProps {
  /* tableName: string */
}

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: TestStackProps) {
    super(scope, id, props)

    const authSecret = Secret.fromSecretNameV2(this, "AuthSecret", "bitter")

    const handler = new NodejsFunction(this, "TestHandler", {
      description: "Main test handler",
      runtime: Runtime.NODEJS_16_X,
      architecture: Architecture.ARM_64,
      entry: "lib/functions/test-handler.ts",
      memorySize: 256,
      timeout: Duration.minutes(15),
      environment: {
        SECRET_ARN: authSecret.secretArn,
        API_URL: "https://api.bitter.fyi/graphql",
        TABLE_NAME: "bitter-table",
      },
      bundling: {
        format: OutputFormat.ESM,
        tsconfig: "lib/functions/tsconfig.json",
        /* target: "node14.8", */
        nodeModules: [
          "@aws-sdk/client-secrets-manager",
          "@aws-sdk/client-dynamodb",
          "@aws-sdk/lib-dynamodb",
          "@aws-sdk/util-dynamodb",
          "@faker-js/faker",
        ],
      },
      initialPolicy: [
        new PolicyStatement({
          actions: ["*"],
          resources: [
            "arn:aws:dynamodb:us-east-1:119712928745:table/bitter-table",
          ],
        }),
      ],
    })

    authSecret.grantRead(handler)
    const functionTarget = new LambdaFunction(handler)

    new Rule(this, "OneMinuteRule", {
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [functionTarget],
    })
  }
}
