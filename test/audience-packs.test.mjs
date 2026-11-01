import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildToolkit } from "../scripts/lib/toolkit-build.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
test("owner audience packs ship overlapping readers before update skills are available",async()=>{
 const output=await buildToolkit({root});
 const catalog=JSON.parse(output.generated[".agents/plugins/marketplace.json"]);
 for(const [pack,required] of [
  ["govisit-destination",["govisit-search-destinations","govisit-get-destination-overview","govisit-get-destination-section"]],
  ["govisit-local-business",["govisit-search-places","govisit-get-place-overview","govisit-get-place-section","govisit-get-place-visit-facts"]]
 ]){
  assert.ok(output.plugins.includes(pack),pack+" is installable now");
  assert.ok(catalog.plugins.some(p=>p.name===pack));
  for(const name of required){
   const resource=output.generated[`plugins/${pack}/skills/${name}/SKILL.md`];
   assert.ok(resource,pack+" includes "+name);
   assert.equal(resource,output.generated[`plugins/govisit/skills/${name}/SKILL.md`]);
  }
  assert.ok(!Object.keys(output.generated).some(p=>p.startsWith(`plugins/${pack}/skills/govisit-update-`)));
 }
});
