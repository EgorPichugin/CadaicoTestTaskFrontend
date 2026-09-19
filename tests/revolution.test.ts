import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LatheGeometry, Vector2 } from 'three'
import { revolutionProfile } from '../src/lib/revolution.ts'
import type { GeometryResult } from '../src/lib/geometry.ts'
const g: GeometryResult = {status:'Success', units:'mm', is_closed:true, vertices:[{id:'p0',x:0,y:0},{id:'p1',x:0,y:10},{id:'p2',x:30,y:10},{id:'p3',x:30,y:0},{id:'p4',x:30,y:-10},{id:'p5',x:0,y:-10}], edges:[], issues:[]}
g.edges = g.vertices.map((p,i) => ({id:`e${i}`,type:'line',from:p.id,to:g.vertices[(i+1)%6]!.id,length:10}))
test('revolves only the upper half, retaining both axis endpoints',()=> {
 const before=JSON.stringify(g), p=revolutionProfile(g)
 assert.deepEqual(p,[{x:0,y:0},{x:0,y:10},{x:30,y:10},{x:30,y:0}])
 assert.equal(JSON.stringify(g),before)
 const mesh=new LatheGeometry(p.map(v=>new Vector2(v.y,v.x)),128)
 mesh.rotateZ(-Math.PI/2); mesh.computeBoundingBox()
 assert.ok(Math.abs(mesh.boundingBox!.max.x-30)<1e-5)
 assert.ok(Math.abs(mesh.boundingBox!.max.y-10)<1e-5)
 assert.ok(Math.abs(mesh.boundingBox!.min.z+10)<1e-5)
 mesh.dispose()
})
test('samples arcs using their center, radius and clockwise sweep',()=>{
 const data=structuredClone(g)
 data.vertices[1]={id:'p1',x:10,y:10}
 data.edges[0]={id:'e0',type:'arc',from:'p0',to:'p1',radius:10,center:{x:10,y:0},clockwise:true,sweep_angle_degrees:90,shape:'out',arc_size:'minor'}
 const p=revolutionProfile(data)
 assert.equal(p.length,93)
 for(const v of p.slice(0,91)) assert.ok(Math.abs(Math.hypot(v.x-10,v.y)-10)<1e-8)
 assert.deepEqual(p.at(-1),{x:30,y:0})
})
test('rejects incomplete geometry',()=>{ assert.throws(()=>revolutionProfile({...g,status:'Unresolved'})) })
