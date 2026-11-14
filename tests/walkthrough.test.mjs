import test from 'node:test';
import assert from 'node:assert/strict';
import { initWalkthrough } from '../src/walkthrough.js';

test('walkthrough tolerates a first animation timestamp earlier than its start clock', () => {
  const original = Object.fromEntries(['window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let tick;
  const handlers = {};
  const play = {addEventListener: (type, fn) => handlers[type] = fn, setAttribute() {}};
  const fields = new Map();
  const buttons = ['scan', 'outreach', 'moving'].map(step => ({dataset:{walkthroughSelect:step},addEventListener(){},setAttribute(){}}));
  const scene = {dataset:{walkthroughState:'ready'},style:{setProperty(){}}, querySelector(selector) {
    if (selector === '[data-walkthrough-play]') return play;
    if (!fields.has(selector)) fields.set(selector, {textContent:''});
    return fields.get(selector);
  },querySelectorAll: () => buttons};
  try {
    const values = {window:{matchMedia:()=>({matches:false,addEventListener(){}})},document:{hidden:false,addEventListener(){}},performance:{now:()=>100},requestAnimationFrame:fn=>(tick=fn,1),cancelAnimationFrame(){}};
    for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    initWalkthrough({querySelectorAll:()=>[scene]});
    handlers.click();
    assert.doesNotThrow(()=>tick(99));
    assert.equal(fields.get('[data-walkthrough-time]').textContent, '0:00 / 0:18');
    tick(6200);
    assert.equal(scene.dataset.walkthroughStep, 'outreach');
    assert.equal(fields.get('[data-walkthrough-ehr-status]').textContent, 'Signals found');
  } finally {
    for (const [key,descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
});
