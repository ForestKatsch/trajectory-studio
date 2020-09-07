
attribute vec3 aPosition;
//attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

//varying vec3 vNormal;

void main() {
  //gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  gl_Position = vec4(aPosition, 1.0);
  //vNormal = aNormal;
}
