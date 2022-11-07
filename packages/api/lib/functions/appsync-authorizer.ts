import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from "aws-lambda"
/* import { decode, JWT } from "next-auth/jwt" */

interface SecretJson {
  secret: string
}

type ResolverContext = {
  subscriber: boolean
}

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION,
})
const secretArn = process.env.SECRET_ARN as string
const { SecretString: secretString } = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: secretArn })
)
const { secret } = JSON.parse(secretString || "{}") as SecretJson

export const handler = async (
  event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult<ResolverContext>> => {
  if (!secret) {
    throw new Error("Could not get signing secret from secrets manager.")
  }

  let { authorizationToken: token } = event

  // Handle cookie passed from session
  if (token.includes("next-auth.session-token=")) {
    const cookies = Object.fromEntries(
      token
        .split(";")
        .map((cookie) =>
          cookie
            .trim()
            .replace("__Secure-", "")
            .replace("next-auth.", "")
            .split("=")
        )
    ) as Record<string, string>

    token = cookies["session-token"]
  }

  if (token === secret) {
    return {
      isAuthorized: true,
      /* resolverContext: { sub: "system", type: "SYSTEM", subscriber: false }, */
    }
  }

  try {
    /* const decoded = await decode({ token, secret }) */
    /* console.log("Token:") */
    /* console.log(JSON.stringify(decoded)) */
    /**/
    /* if (!decoded || !decoded.sub) { */
    /*   console.log("No token decoded; returning unauthorized") */
    /*   return { isAuthorized: false } */
    /* } */

    /* const user = await getUser(decoded.sub) */
    /* if (!user) { */
    /*   console.log("No user found in the system; returning unauthorized") */
    /*   return { isAuthorized: false } */
    /* } */

    const deniedFields = systemActions.slice()

    const context = {
      isAuthorized: true,
      /* resolverContext: { ...decoded, subscriber }, */
      deniedFields,
    }
    console.log(context)

    return context
  } catch (error) {
    console.error(error)
    return { isAuthorized: false }
  }
}

const systemActions = [
  "Mutation.createVerificationToken",
  "Mutation.deleteVerificationToken",
  "Mutation.createUser",
  "Mutation.updateUser",
  "Mutation.deleteUser",
  "Mutation.createAccount",
  "Mutation.deleteAccount",
  "Query.getUser",
  "Query.getUserByEmail",
  "Query.getUserByAccount",
  "Query.getStaticPaths",
]
