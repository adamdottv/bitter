import fs from "fs"

const [prod, scope] = process.argv.slice(2)
if (!prod && !scope) process.exit(1)

const context = {
  prod: prod === "true" || undefined,
  scope: scope || undefined,
}
fs.writeFileSync("cdk.context.json", JSON.stringify(context))
