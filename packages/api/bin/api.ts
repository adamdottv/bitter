#!/usr/bin/env node
import * as cdk from "aws-cdk-lib"
import { ApiStack } from "../lib/api-stack"
import { TestStack } from "../lib/test-stack"

const app = new cdk.App()
const scope = (app.node.tryGetContext("scope") as string)?.replace(/\W/gi, "-")
const prod = (app.node.tryGetContext("prod") as boolean) ?? false

const account = process.env.CDK_DEFAULT_ACCOUNT

const hostedZoneName = "bitter.fyi"
const hostedZoneId = "Z01241542FWY7NUA7WM3U"
const domainName = "api.bitter.fyi"

const allRegions = [
  "us-east-1", // Virginia, primary
  /* "us-west-2", // Oregon */
  /* "eu-central-1", // Frankfurt */
  /* "ap-southeast-2", // Sydney */
  /* "ap-south-1", // Mumbai */
]

const [primaryRegion, ...regions] = allRegions

const createApiStack = (region: string): ApiStack => {
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
    region,
    regions,
    env: { account, region },
  })
}

const primaryStack = createApiStack(primaryRegion)
if (prod) regions.map((region) => createApiStack(region))

const testingRegions = [
  /* "us-east-1", */
  /* "us-west-2", */
  /* "eu-central-1", */
  /* "ap-south-1", */
  /* "ap-southeast-2", */
  "us-east-2",
  "us-west-1",
  "ap-northeast-3",
  "ap-northeast-2",
  "ap-southeast-1",
  "ap-northeast-1",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "me-central-1",
  "sa-east-1",
]

const createTestStack = (region: string): TestStack => {
  const stackName = `TestStack${scope ? `-${scope}` : ""}-${region}`
  return new TestStack(app, stackName, {})
}

createTestStack("us-east-1")

/* for (const region in testingRegions) { */
/*   createTestStack(region) */
/* } */
