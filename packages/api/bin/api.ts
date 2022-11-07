#!/usr/bin/env node
import * as cdk from "aws-cdk-lib"
import { ApiStack } from "../lib/api-stack"

const app = new cdk.App()
const scope = (app.node.tryGetContext("scope") as string)?.replace(/\W/gi, "-")
const prod = (app.node.tryGetContext("prod") as boolean) ?? false

const account = process.env.CDK_DEFAULT_ACCOUNT

const hostedZoneName = "bitter.fyi"
const hostedZoneId = "Z01241542FWY7NUA7WM3U"
const domainName = "api.bitter.fyi"

const allRegions = [
  "us-east-1", // Virginia, primary
  "eu-central-1", // Frankfurt
  "us-west-2", // Oregon
  "ap-southeast-2", // Sydney
  "ap-south-1", // Mumbai
]

const [primaryRegion, ...regions] = allRegions

const createStack = (
  region: string,
  secretArn?: string,
  certificateArn?: string
): ApiStack => {
  const main = region === primaryRegion
  const stackName = `ApiStack${scope ? `-${scope}` : ""}${
    !main ? `-${region}` : ""
  }`
  return new ApiStack(app, stackName, {
    prod,
    main,
    hostedZoneName,
    hostedZoneId,
    domainName,
    scope,
    certificateArn,
    secretArn,
    region,
    regions: main ? regions : undefined,
    env: { account, region },
  })
}

const primaryStack = createStack(primaryRegion)
if (prod)
  regions.map((region) =>
    createStack(
      region,
      primaryStack.authSecret.secretArn,
      primaryStack.apiCertificate.certificateArn
    )
  )
