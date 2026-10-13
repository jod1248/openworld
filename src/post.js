import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Camera-lens look applied after tone mapping: colour grade, vignette and film grain
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      // slight chromatic aberration toward the edges
      float ca = dot(d, d) * 0.006;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca).b);
      // colour grade: warm highlights, cool shadows, a touch more contrast and saturation
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.18);
      c = (c - 0.5) * 1.08 + 0.5;
      c *= mix(vec3(0.92, 0.95, 1.06), vec3(1.06, 1.0, 0.92), smoothstep(0.1, 0.8, l));
      // vignette
      c *= 1.0 - smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0))) * 0.55;
      // film grain
      c += (hash(vUv * 1000.0 + time) - 0.5) * 0.035;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.5, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  return {
    render(dt) {
      lens.uniforms.time.value = (lens.uniforms.time.value + dt * 7.3) % 100;
      composer.render(dt);
    },
    setSize(w, h) { composer.setSize(w, h); bloom.setSize(w / 2, h / 2); },
  };
}
