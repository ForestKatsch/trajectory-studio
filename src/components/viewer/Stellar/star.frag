precision mediump float;

uniform vec3 uColor;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  float brightness = dot(vWorldNormal, vec3(0.0, 0.0, 1.0));
  gl_FragColor = vec4(uColor * pow(brightness, 1.0), 1.0);
}
