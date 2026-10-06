// Controlled hook/network regression executing the actual compiled TSX handlers.
// This complements real-browser evidence; it is not a DOM/browser renderer.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'../../fe');const ts=require(root+'/node_modules/typescript');
let params=new URLSearchParams('anchor_product_id=A&anchor_product_version_id=A-v1&anchor_catalog_snapshot_id=s');let cursor=0,slots=[],effects=[],fetches=[];
const react={
 useRef(v){const i=cursor++;if(!slots[i])slots[i]={current:v};return slots[i]},
 useState(v){const i=cursor++;if(!slots[i])slots[i]={value:typeof v==='function'?v():v};return [slots[i].value,x=>{slots[i].value=typeof x==='function'?x(slots[i].value):x}]},
 useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||!deps||deps.some((x,j)=>!Object.is(x,old.deps[j]))){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()}})}},
};
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};const modules={};
function load(file){if(modules[file])return modules[file];const exp={};modules[file]=exp;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const context={exports:exp,require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return jsx;if(name==='next/link')return {__esModule:true,default:'Link'};if(name==='next/navigation')return {useSearchParams:()=>params};if(name.endsWith('.css'))return {default:{}};if(name.startsWith('@/')){const base=root+'/src/'+name.slice(2);return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx')}if(name==='./validation')return load(root+'/src/components/composed-search/validation.ts');throw Error(name)},
 URL,URLSearchParams,AbortController,DOMException,FormData,fetch(url,options){if(url==='/api/auth/csrf')return Promise.resolve(Response.json({header_name:'X-CSRF-TOKEN',token:'owned-test'}));let resolve;const promise=new Promise(r=>resolve=r);fetches.push({url,options,resolve});return promise}};
 vm.runInNewContext(code,context,{filename:file});return exp;}
const component=load(root+'/src/components/composed-search/composed-search-workbench.tsx').ComposedSearchWorkbench;
let tree;function render(){cursor=0;tree=component();const todo=effects;effects=[];todo.forEach(fn=>fn());return tree}
function nodes(node,out=[]){if(!node)return out;if(Array.isArray(node)){node.forEach(x=>nodes(x,out));return out}if(typeof node==='object'){out.push(node);nodes(node.props?.children,out)}return out}
const find=(type,label)=>nodes(tree).find(x=>x.type===type&&x.props?.children===label);
const text=()=>JSON.stringify(tree);
const detail=id=>({product_id:id,product_version_id:id+'-v1',title:'Product '+id,category:'TOP',image_url:'/api/catalog/images/'+id+'/'+id+'-v1',publication:{catalog_snapshot_id:'s',model_version:'m',index_version:'i'},description:null});
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
(async()=>{
 render();assert.equal(fetches.length,1);assert.ok(text().includes('Đang xác thực'));
 find('button','Tải ảnh lên').props.onClick();render();assert.equal(fetches[0].options.signal.aborted,true);
 find('button','Dùng sản phẩm đã chọn').props.onClick();render();assert.equal(fetches.length,2);
 fetches[0].resolve(Response.json(detail('OLD')));await flush();render();assert.equal(text().includes('Product OLD'),false);
 fetches[1].resolve(Response.json(detail('A')));await flush();render();assert.ok(text().includes('Product A'));console.log('PASS actual TSX pending PRODUCT→UPLOAD→PRODUCT revalidates; OLD validation discarded');
 // Use actual event handlers to issue a PRODUCT request for A, hold its response.
 const textarea=nodes(tree).find(x=>x.type==='textarea');textarea.props.onChange({target:{value:'red shirt'}});render();
 const form=nodes(tree).find(x=>x.type==='form');const submitted=form.props.onSubmit({preventDefault(){}});await flush();const search=fetches.find(x=>x.url==='/api/search/composed');assert.ok(search);assert.equal(search.options.body.get('anchor_product_id'),'A');
 // Model the documented same-route URL context transition without remount.
 params=new URLSearchParams('anchor_product_id=B&anchor_product_version_id=B-v1&anchor_catalog_snapshot_id=s');render();
 const validationB=fetches.at(-1);validationB.resolve(Response.json(detail('B')));await flush();render();assert.ok(text().includes('Product B'));
 search.resolve(Response.json({schema_version:'1.0.0',mode:'COMPOSED',query_id:'q',reference:{type:'PRODUCT',anchor_product_id:'A',anchor_product_version_id:'A-v1',anchor_catalog_snapshot_id:'s'},exclusion_policy:'EXCLUDE_ANCHOR_PRODUCT',provenance:{text_overflow_policy:'REJECT',self_match_policy:'EXCLUDE_ANCHOR_PRODUCT',fusion:{fusion_version:'v',image_weight:.5,text_weight:.5},artifact_scope:'PILOT_ONLY'},publication:{catalog_snapshot_id:'s'},results:[{product_id:'A_RESULT',product_version_id:'A_RESULT-v1',title:'A stale result',category:'TOP',image_url:'/img',rank:1,similarity_score:.9}]}));await submitted;await flush();render();
 console.log(JSON.stringify({probe:'actual_tsx_anchor_change_during_search',sourceHead:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),newPreviewB:text().includes('Product B'),oldSearchSignalAborted:search.options.signal.aborted,oldResultVisible:text().includes('A stale result')}));
 assert.equal(search.options.signal.aborted,true);assert.equal(text().includes('A stale result'),false);
 // Complete a search on B, then switch URL to C: old completed results must
 // disappear in the very first render, before any new validation settles.
 const secondSubmit=nodes(tree).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});await flush();const searchB=fetches.filter(x=>x.url==='/api/search/composed').at(-1);
 searchB.resolve(Response.json({schema_version:'1.0.0',mode:'COMPOSED',query_id:'q2',reference:{type:'PRODUCT',product_id:'B',product_version_id:'B-v1'},provenance:{text_overflow_policy:'REJECT',self_match_policy:'EXCLUDE_ANCHOR_PRODUCT',fusion:{fusion_version:'v',image_weight:.5,text_weight:.5}},publication:{catalog_snapshot_id:'s'},results:[{product_id:'B_RESULT',product_version_id:'B_RESULT-v1',title:'B completed result',category:'TOP',image_url:'/img',rank:1,similarity_score:.8}]}));await secondSubmit;await flush();render();assert.ok(text().includes('B completed result'));
 params=new URLSearchParams('anchor_product_id=C&anchor_product_version_id=C-v1&anchor_catalog_snapshot_id=s');render();console.log(JSON.stringify({probe:'actual_tsx_completed_results_context_change',oldCompletedResultVisible:text().includes('B completed result')}));
 assert.equal(text().includes('B completed result'),false);
})().catch(e=>{console.error(e.stack);process.exitCode=1});
