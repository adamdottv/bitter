import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from "aws-lambda"
import jwt from "jsonwebtoken"

type ResolverContext = {}

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION,
})
const secretArn = process.env.SECRET_ARN as string
const { SecretString: secret } = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: secretArn })
)

export const handler = async (
  event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult<ResolverContext>> => {
  if (!secret) {
    throw new Error("Could not get signing secret from secrets manager.")
  }

  let { authorizationToken: token } = event

  if (token === secret) {
    return {
      isAuthorized: true,
      resolverContext: { sub: "system", type: "SYSTEM" },
    }
  }

  try {
    const decoded = jwt.verify(token, secret)
    return {
      isAuthorized: true,
      resolverContext: decoded,
    }
  } catch (error) {
    console.error(error)
    return { isAuthorized: false }
  }
}
