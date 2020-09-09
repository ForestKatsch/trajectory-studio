
#import "../../../../webgl/shaders/depth.glsl";

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uWorldMatrix;
uniform mat4 uProjectionMatrix;
uniform vec4 uCameraData;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vNormal;

void main() {
  vPosition = aPosition;
  vNormal = aNormal;
  vWorldPosition = (uWorldMatrix * vec4(aPosition, 1.0)).xyz;
  vWorldNormal = normalize((uWorldMatrix * vec4(aNormal, 0.0)).xyz);
  
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);

  gl_Position = depthBufferLogVert(gl_Position, 1.0, uCameraData.y);
}
