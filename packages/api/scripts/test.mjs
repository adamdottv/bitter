import { Lambda, InvokeCommand } from "@aws-sdk/client-lambda"
import outputs from "../outputs.json" assert { type: "json" }

const virginiaClient = new Lambda({ region: "us-east-1" })
/* const oregonClient = new Lambda({ region: "us-west-2" }) */
/* const frankfurtClient = new Lambda({ region: "eu-central-1" }) */
/* const sydneyClient = new Lambda({ region: "ap-southeast-2" }) */
/* const mumbaiClient = new Lambda({ region: "ap-south-1" }) */

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

const invoke = async () => {
  return virginiaClient.send(
    new InvokeCommand({
      FunctionName: outputs["TestStack-us-east-1"].TestFunctionArn,
    })
  )
}

const runner = async () => {
  while (true) {
    const promises = []
    for (let index = 0; index < 10; index++) {
      promises.push(invoke())
    }

    console.time("runner")
    await Promise.all(promises)
    console.timeEnd("runner")
  }
}

const promises = []
for (let index = 0; index < 10; index++) {
  promises.push(runner())
  await delay(100)
}

await Promise.all(promises)
