import type { SurfaceFrame } from "./types";

const VERTEX_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision mediump float;

uniform vec2 u_resolution;
uniform vec4 u_rect;
uniform float u_radius;
uniform vec4 u_color;
uniform float u_shadow;
uniform float u_bend;

float roundedBoxSDF(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 center = u_rect.xy + u_rect.zw * 0.5;
  vec2 halfSize = u_rect.zw * 0.5;

  vec2 p = frag - center;
  float across = clamp((frag.x - u_rect.x) / max(u_rect.z, 1.0), 0.0, 1.0);
  float bend = sin(across * 3.14159265) * u_bend;
  p.y -= bend;

  float r = min(u_radius, min(halfSize.x, halfSize.y));
  float d = roundedBoxSDF(p, halfSize, r);

  float surface = 1.0 - smoothstep(-1.0, 1.0, d);

  float shadowSpread = 24.0;
  float shadow = (1.0 - smoothstep(0.0, shadowSpread, d)) * u_shadow;
  shadow *= 1.0 - surface;

  vec3 rgb = u_color.rgb * u_color.a * surface;
  float alpha = u_color.a * surface + shadow * 0.28;
  gl_FragColor = vec4(rgb, alpha);
}
`;

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export type SurfaceProgram = {
  draw: (frame: SurfaceFrame, bend: number, dpr: number) => void;
  destroy: () => void;
};

export const createSurfaceProgram = (
  gl: WebGLRenderingContext,
): SurfaceProgram | null => {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(program, "a_pos");
  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uRect = gl.getUniformLocation(program, "u_rect");
  const uRadius = gl.getUniformLocation(program, "u_radius");
  const uColor = gl.getUniformLocation(program, "u_color");
  const uShadow = gl.getUniformLocation(program, "u_shadow");
  const uBend = gl.getUniformLocation(program, "u_bend");

  return {
    draw: (frame, bend, dpr) => {
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uResolution, w, h);
      gl.uniform4f(
        uRect,
        frame.x * dpr,
        frame.y * dpr,
        frame.width * dpr,
        frame.height * dpr,
      );
      gl.uniform1f(uRadius, frame.radius * dpr);
      gl.uniform4f(uColor, ...frame.color);
      gl.uniform1f(uShadow, frame.shadow);
      gl.uniform1f(uBend, bend * dpr);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
};
