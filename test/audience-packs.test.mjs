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

test("blog readers ship in All and Travel Planner while owner selections retain their scope", async () => {
  const output = await buildToolkit({ root });
  const manifest = JSON.parse(output.assets["release-manifest.json"]);
  for (const [name, count, includesBlogs] of [["govisit", 25, true], ["govisit-travel-planner", 21, true], ["govisit-destination", 13, false], ["govisit-local-business", 10, false]]) {
    const pack = manifest.plugins.find(pack => pack.name === name);
    assert.equal(pack.skills.length, count, name);
    for (const skill of ["govisit-get-blog-post", "govisit-search-blog-posts"]) {
      assert.equal(pack.skills.includes(skill), includesBlogs, `${name}: ${skill}`);
      if (includesBlogs) {
        const contract = JSON.parse(output.generated[`plugins/${name}/skills/${skill}/references/contract.json`]);
        assert.ok(contract.inputSchema.required.includes("pagePath"));
        assert.equal(contract.annotations.readOnlyHint, true);
        assert.equal(contract.endpoint, `https://govisit.ai/api/tools/v1/${contract.tool}`);
      }
    }
  }
});
