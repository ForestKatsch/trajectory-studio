precision highp float;

uniform vec3 uColor;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform vec4 uAtmosphereParameters;
uniform vec4 uAtmosphereRaleighScatter;

uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;
uniform mat4 uViewMatrix;
uniform mat4 uViewMatrix_i;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

#import "./include.glsl";
#import "./atmosphere.glsl";

void main() {
  vec3 dir_starModel = worldToModelDirection(getDirectionStar());
  vec3 dir_viewModel = worldToModelDirection(getDirectionView());
  
  vec3 pos_cameraModel = (uWorldMatrix_i * vec4(uViewMatrix_i[3].xyz, 1.0)).xyz;
  //vec3 view_direction = normalize((uWorldMatrix_i * vec4(vWorldPosition - camera_position, 0.0)).xyz);
  
  gl_FragColor = vec4(atmosphereSkyColor(pos_cameraModel, dir_viewModel, dir_starModel, uStarColor, uAtmosphereParameters, uAtmosphereRaleighScatter), 1.0);
}
