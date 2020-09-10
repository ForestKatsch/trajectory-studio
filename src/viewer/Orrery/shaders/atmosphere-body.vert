
#import "../../../webgl/shaders/depth.glsl";

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;
uniform mat4 uViewMatrix;
uniform mat4 uViewMatrix_i;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec4 uCameraData;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform vec4 uAtmosphereParameters;
uniform vec4 uAtmosphereRaleighScatter;

varying vec3 vPosition;
varying vec3 vScreenPosition;
varying vec3 vWorldPosition;

varying vec3 vWorldNormal;
varying vec3 vNormal;

varying vec3 vAtmosphereColor;

#import "./include.glsl";
#import "./atmosphere.glsl";

void main() {
  vPosition = aPosition;
  vNormal = aNormal;
  vWorldPosition = (uWorldMatrix * vec4(aPosition, 1.0)).xyz;
  vWorldNormal = normalize((uWorldMatrix * vec4(aNormal, 0.0)).xyz);
  
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);

  gl_Position = depthBufferLogVert(gl_Position, 1.0, uCameraData.y);

  vScreenPosition = gl_Position.xyz / gl_Position.w;

  // Compute the atmosphere in vertex-space.
  vec3 dir_starModel = worldToModelDirection(getDirectionStar());
  vec3 dir_viewModel = worldToModelDirection(getDirectionView());
  
  vec3 pos_cameraModel = (uWorldMatrix_i * vec4(uViewMatrix_i[3].xyz, 1.0)).xyz;
  
  vAtmosphereColor = atmospherePlanetColor(pos_cameraModel, dir_viewModel, dir_starModel, uStarColor, uAtmosphereParameters, uAtmosphereRaleighScatter, 0.6);
}
