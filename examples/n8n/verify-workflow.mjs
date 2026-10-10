import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const w=JSON.parse(fs.readFileSync(new URL('./deepsearchqa-csv.json', import.meta.url),'utf8'));
const code=name=>w.nodes.find(n=>n.name===name).parameters.jsCode;
const run=(name,json,expected=1)=>vm.runInNewContext('(function(){'+code(name)+'})()',{$input:{first:()=>({json})},$:()=>({first:()=>({json:{declared_rows:expected}})})});
const d={id:'24cf80b3-5f47-4da6-a6a5-0540b3688343',status:'active',pricing_type:'free',schema:{row_count:900}};
assert.equal(run('Check free listing',d)[0].json.declared_rows,900);
for(const changed of [{...d,pricing_type:'buy_it_now'},{...d,status:'removed'},{...d,id:'other'},{...d,schema:{row_count:1001}}])assert.throws(()=>run('Check free listing',changed));
const row={problem:'A comma, a quote " and\na newline',problem_category:'Synthetic fixture',answer:'test',answer_type:'Single Answer'};
assert.equal(run('Validate NDJSON rows',{data:JSON.stringify(row)+'\n'})[0].json.problem,row.problem);
assert.throws(()=>run('Validate NDJSON rows',{data:''}));
assert.throws(()=>run('Validate NDJSON rows',{data:JSON.stringify(row)+'\n'},2));
assert.throws(()=>run('Validate NDJSON rows',{data:'{invalid'}));
assert.throws(()=>run('Validate NDJSON rows',{data:JSON.stringify({...row,answer:null})}));
for(const n of w.nodes.filter(n=>n.type.endsWith('.httpRequest'))) {
 assert.equal(new URL(n.parameters.url).origin,'https://api.databazaar.io');
 assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);
 assert.ok(!n.parameters.url.includes('/buy'));
 assert.ok(!n.credentials);
}
console.log(JSON.stringify({guard_checks:'passed',scope:'metadata refusal, truncated/malformed/wrong-schema rows, credential-free export and fixed no-redirect HTTP destinations'}));
