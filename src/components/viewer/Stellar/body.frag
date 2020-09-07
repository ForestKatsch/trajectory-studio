precision mediump float;

uniform vec3 uColor;
uniform vec3 uStarPosition;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  float star_brightness = dot(vWorldNormal, normalize(uStarPosition - vWorldPosition));

  star_brightness = smoothstep(0.0, 0.5, star_brightness) * 1.0;
  
  gl_FragColor = vec4(uColor * star_brightness, 1.0);
}
