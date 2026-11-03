// GLSL port of ashvyagni/Cosmogon's black_hole.wgsl (MIT OR Apache-2.0).
// Source pinned at 86c25027ec31957fee698744ee909ece29e429dd:
// https://github.com/ashvyagni/cosmogon/blob/86c25027ec31957fee698744ee909ece29e429dd/crates/cosmogon/src/render/shaders/black_hole.wgsl
// Changes: Three.js/local-space bindings, GLSL syntax, and Three.js display output.

uniform mat4 modelMatrix;
uniform vec3 uCamera;
uniform vec3 uDiskNormal;
uniform vec3 uParams; // bounding radius, inner disk radius, outer disk radius, in r_s
uniform float uBrightness;
uniform float uTime;
uniform samplerCube uSky;
uniform sampler2D uText;
uniform float uZoomProgress;
uniform float uAspect;
varying vec3 vHolePosition;

// Spaghettification of the background text.
// Each source distance `a` (from the vertical axis, in half-view-widths) falls toward the
// hole at its own time: inner letters first, outer letters last. Screen position is
// d(a) = a * (1 - w(a, pull)). Because inner points move faster than outer ones, the strip
// between them is stretched horizontally by d'(a); the vertical axis is scaled by 1/d'(a)
// so the area (volume) of every piece of text is preserved.
float infallFraction(float a, float pull) {
  return smoothstep(0.0, 1.0, (pull - (a - 0.2)) / 0.4);
}

float infallPosition(float a, float pull) {
  return a * (1.0 - infallFraction(a, pull));
}

vec3 sampleWarpedText(vec3 dir) {
  float pull = uZoomProgress;
  if (dir.z >= -0.05 || pull >= 0.999) return vec3(0.0);

  float halfSpan = 0.7673 * clamp(uAspect, 1.0, 2.0);
  vec2 p = dir.xy / (-dir.z) / halfSpan;
  float side = p.x < 0.0 ? -1.0 : 1.0;
  float d = abs(p.x);

  // Invert d(a) by bisection (d(a) is monotonic increasing).
  float lo = 0.0;
  float hi = 1.0;
  for (int i = 0; i < 14; i++) {
    float mid = 0.5 * (lo + hi);
    if (infallPosition(mid, pull) < d) lo = mid; else hi = mid;
  }
  float a = 0.5 * (lo + hi);

  // Local horizontal stretch d'(a); vertical coordinate is scaled to keep area constant.
  float e = 0.01;
  float stretch = (infallPosition(a + e, pull) - infallPosition(a - e, pull)) / (2.0 * e);
  stretch = max(stretch, 0.02);
  float ySrc = p.y * stretch;

  // Canvas covers 0.8 view-widths; word centres at +-0.62; 2.5 v-units per view-width.
  const float canvasWidth = 0.8;
  const float wordCenter = 0.62;
  float u = 0.5 + (a * side - side * wordCenter) / canvasWidth;
  float v = (side < 0.0 ? 0.75 : 0.25) + ySrc * 2.5;

  float vLo = side < 0.0 ? 0.52 : 0.02;
  float vHi = side < 0.0 ? 0.98 : 0.48;
  if (u < 0.02 || u > 0.98 || v < vLo || v > vHi) return vec3(0.0);

  vec4 sampleColor = texture2D(uText, vec2(u, v));
  // Stretched strands near the hole run hot.
  float heat = smoothstep(0.35, 0.0, d) * smoothstep(0.0, 0.3, pull);
  vec3 tint = mix(vec3(0.95, 0.97, 1.0), vec3(1.0, 0.72, 0.42), heat * 0.8);
  return sampleColor.rgb * sampleColor.a * tint * 1.35;
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 diskColor(float r, float phi, vec3 velDir, vec3 rayDir) {
  float rin = uParams.y;
  float rout = uParams.z;
  if (r < rin || r > rout) return vec4(0.0);
  float x = rin / r;
  float temp = pow(x, 0.75) * (1.0 - sqrt(x) * 0.9);
  float beta = sqrt(0.5 / r);
  float gamma = 1.0 / sqrt(max(1.0 - beta * beta, 1e-3));
  float cosang = dot(normalize(velDir), -normalize(rayDir));
  float doppler = 1.0 / (gamma * (1.0 - beta * cosang));
  float grav = sqrt(max(1.0 - 1.0 / r, 0.0));
  float shift = doppler * grav;
  float intensity = temp * pow(shift, 4.0) * 2.2;
  float swirl = phi + 3.0 * log(r) - uTime * 0.4 / pow(r, 1.5);
  float streak = 0.65 + 0.35 * sin(swirl * 7.0 + 3.0 * sin(swirl * 2.0 + r));
  float grain = 0.85 + 0.3 * hash2(vec2(floor(swirl * 40.0), floor(r * 8.0)));
  vec3 warm = vec3(1.0, 0.30, 0.05);
  vec3 hot = vec3(1.0, 0.72, 0.42);
  vec3 color = mix(warm, hot, clamp(temp * 3.0 * shift, 0.0, 1.0));
  color *= vec3(clamp(1.3 - 0.3 * shift, 0.6, 1.3), 1.0,
                clamp(0.7 + 0.3 * shift, 0.7, 1.4));
  float edge = smoothstep(rin, rin * 1.15, r)
             * (1.0 - smoothstep(rout * 0.7, rout, r));
  float alpha = clamp(intensity * edge * streak, 0.0, 1.0) * 0.92;
  return vec4(color * intensity * streak * grain * edge * uBrightness, alpha);
}

void main() {
  float bound = uParams.x;
  vec3 cam = uCamera;
  vec3 dir0 = normalize(vHolePosition - cam);
  bool inside = length(cam) < bound;
  // Draw the near sphere face outside, and the far face when the camera enters it.
  if (inside == gl_FrontFacing) discard;

  vec3 pos = cam;
  if (!inside) {
    float b = dot(cam, dir0);
    float c = dot(cam, cam) - bound * bound;
    float discriminant = b * b - c;
    if (discriminant < 0.0) discard;
    pos = cam + dir0 * max(-b - sqrt(discriminant), 0.0);
  }

  vec3 vel = dir0;
  vec3 normal = normalize(uDiskNormal);
  float h2 = dot(cross(pos, vel), cross(pos, vel));
  vec3 color = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  for (int i = 0; i < 220; i++) {
    float r = length(pos);
    if (r < 1.0) { captured = true; break; }
    if (r > bound * 1.02 && dot(pos, vel) > 0.0) break;
    float dt = clamp(0.08 * r, 0.02, 2.5);
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 prev = pos;
    vel += acc * dt;
    pos += vel * dt;
    if (uBrightness > 0.0) {
      float s0 = dot(prev, normal);
      float s1 = dot(pos, normal);
      if (s0 * s1 < 0.0) {
        vec3 hit = mix(prev, pos, s0 / (s0 - s1));
        vec3 velDir = cross(normal, hit);
        vec3 e1 = normalize(cross(normal, vec3(0.0, 0.0, 1.0) + normal.yzx * 0.1));
        vec3 e2 = cross(normal, e1);
        float phi = atan(dot(hit, e2), dot(hit, e1));
        vec4 disk = diskColor(length(hit), phi, velDir, vel);
        color += trans * disk.rgb;
        trans *= 1.0 - disk.a;
        if (trans < 0.02) break;
      }
    }
  }
  if (!captured) {
    vec3 exitDir = normalize(vel);
    vec3 worldDir = normalize(mat3(modelMatrix) * dir0);
    color += trans * (textureCube(uSky, exitDir).rgb * (inside ? 0.3 : 1.0) + sampleWarpedText(worldDir));
  }
  float impact = length(cross(cam, dir0));
  float alpha = inside ? 1.0 : 1.0 - smoothstep(bound * 0.6, bound * 0.97, impact);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
