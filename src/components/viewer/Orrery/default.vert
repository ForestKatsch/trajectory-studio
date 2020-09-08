
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uWorldMatrix;
uniform mat4 uProjectionMatrix;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewNormal;

void main() {
  vPosition = aPosition;
  vWorldPosition = (uWorldMatrix * vec4(aPosition, 1.0)).xyz;
  vWorldNormal = normalize((uWorldMatrix * vec4(aNormal, 0.0)).xyz);
  
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  
  vViewNormal = normalize(uModelViewMatrix * vec4(aNormal, 1.0)).xyz;
  //vNormal = aNormal;
}
