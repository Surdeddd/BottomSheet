import type { SurfaceFrame } from "./types";

const VERTEX_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = (precision: "highp" | "mediump") => `
precision ${precision} float;

uniform vec2 u_resolution;
uniform vec4 u_rect;
uniform float u_radius;
uniform vec4 u_color;
uniform float u_shadow;
uniform float u_bend;
uniform float u_sheen;
uniform float u_glass;
uniform float u_hasContent;
uniform sampler2D u_content;
uniform float u_hasScroll;
uniform sampler2D u_scroll;
uniform vec4 u_scrollRect;
uniform vec2 u_scrollMap;

float roundedBoxSDF(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 center = u_rect.xy + u_rect.zw * 0.5;
  vec2 halfSize = u_rect.zw * 0.5;

  float across = clamp((frag.x - u_rect.x) / max(u_rect.z, 1.0), 0.0, 1.0);
  float bend = sin(across * 3.14159265) * u_bend;

  vec2 p = frag - center;
  p.y -= bend;

  float r = min(u_radius, min(halfSize.x, halfSize.y));
  float d = roundedBoxSDF(p, halfSize, r);
  float surface = 1.0 - smoothstep(-1.0, 1.0, d);

  vec2 uv = (p + halfSize) / u_rect.zw;
  float down = clamp(uv.y, 0.0, 1.0);

  vec2 glassUv = uv;
  glassUv.x += sin(uv.y * 9.0 + u_bend * 0.08) * u_glass * 0.004;
  glassUv.y += u_glass * 0.002 * sin(uv.x * 7.0);

  vec4 content = vec4(0.0);
  if (u_hasContent > 0.5 &&
      glassUv.x > 0.0 && glassUv.x < 1.0 &&
      glassUv.y > 0.0 && glassUv.y < 1.0) {
    content = texture2D(u_content, glassUv);
  }

  vec4 scroll = vec4(0.0);
  if (u_hasScroll > 0.5 &&
      glassUv.x >= u_scrollRect.x && glassUv.x <= u_scrollRect.z &&
      glassUv.y >= u_scrollRect.y && glassUv.y <= u_scrollRect.w) {
    vec2 st = vec2(
      (glassUv.x - u_scrollRect.x) / max(u_scrollRect.z - u_scrollRect.x, 0.000001),
      (glassUv.y - u_scrollRect.y) * u_scrollMap.x + u_scrollMap.y
    );
    if (st.y >= 0.0 && st.y <= 1.0) {
      scroll = texture2D(u_scroll, st);
    }
  }

  float edge = 1.0 - smoothstep(0.0, 2.5, abs(d));
  float topLight = pow(1.0 - down, 3.0);
  float sheen = (edge * 0.55 + topLight * 0.25) * u_sheen;

  vec3 panelRgb = (u_color.rgb + vec3(sheen)) * u_color.a;
  float panelA = u_color.a;

  vec3 baseRgb = content.rgb + panelRgb * (1.0 - content.a);
  float baseA = content.a + panelA * (1.0 - content.a);
  vec3 rgb = scroll.rgb + baseRgb * (1.0 - scroll.a);
  float alpha = scroll.a + baseA * (1.0 - scroll.a);

  rgb *= surface;
  alpha *= surface;

  float shadow = (1.0 - smoothstep(0.0, 24.0, d)) * u_shadow * (1.0 - surface);
  alpha += shadow * 0.28;

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

export type ScrollLayer = {
  texture: WebGLTexture;
  rect: [number, number, number, number];
  map: [number, number];
};

export type DrawState = {
  bend: number;
  dpr: number;
  sheen: number;
  glass: number;
  content: WebGLTexture | null;
  scroll: ScrollLayer | null;
};

export type SurfaceProgram = {
  draw: (frame: SurfaceFrame, state: DrawState) => void;
  destroy: () => void;
};

export const createSurfaceProgram = (
  gl: WebGLRenderingContext,
  highp = true,
): SurfaceProgram | null => {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  let fs = compile(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SRC(highp ? "highp" : "mediump"),
  );

  if (!fs && highp) {
    fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC("mediump"));
  }
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
  const uSheen = gl.getUniformLocation(program, "u_sheen");
  const uGlass = gl.getUniformLocation(program, "u_glass");
  const uHasContent = gl.getUniformLocation(program, "u_hasContent");
  const uContent = gl.getUniformLocation(program, "u_content");
  const uHasScroll = gl.getUniformLocation(program, "u_hasScroll");
  const uScroll = gl.getUniformLocation(program, "u_scroll");
  const uScrollRect = gl.getUniformLocation(program, "u_scrollRect");
  const uScrollMap = gl.getUniformLocation(program, "u_scrollMap");

  return {
    draw: (frame, state) => {
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
      const dpr = state.dpr;

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
      gl.uniform1f(uBend, state.bend * dpr);
      gl.uniform1f(uSheen, state.sheen);
      gl.uniform1f(uGlass, state.glass);

      gl.uniform1i(uContent, 0);
      gl.uniform1i(uScroll, 1);
      if (state.content) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.content);
        gl.uniform1f(uHasContent, 1);
      } else {
        gl.uniform1f(uHasContent, 0);
      }
      if (state.scroll) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, state.scroll.texture);
        gl.uniform4f(uScrollRect, ...state.scroll.rect);
        gl.uniform2f(uScrollMap, ...state.scroll.map);
        gl.uniform1f(uHasScroll, 1);
        gl.activeTexture(gl.TEXTURE0);
      } else {
        gl.uniform1f(uHasScroll, 0);
      }

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
