precision highp float;

uniform vec3 uStarColor;
uniform vec3 uStarPosition;

uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;
uniform mat4 uViewMatrix;
uniform mat4 uViewMatrix_i;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

#import "./include.glsl";

void main() {
  vec3 dir_view = getDirectionView();
  float brightness = dot(-vWorldNormal, dir_view);
  gl_FragColor = vec4(uStarColor * pow(brightness, 1.0), 1.0);
}
