precision highp float;

uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform vec3 uNightColor;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform samplerCube uLandinfoCube;
uniform samplerCube uNormalCube;
uniform samplerCube uColorCube;

uniform mat4 uViewMatrix_i;
uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;

varying vec3 vPosition;
varying vec3 vScreenPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewNormal;

const float PI = 3.141592653;
const float PI_2 = 6.28318530;

#import "./include.glsl";

void main() {
  vec3 view_direction = getViewDirection();
  vec3 star_direction = getStarDirection();
  
  vec3 t_normal = textureCube(uNormalCube, normalize(vNormal)).rgb * 2.0 - 1.0;
  vec3 world_normal = normalize((uWorldMatrix * vec4(t_normal, 0.0)).xyz);
  
  //float blend = smoothstep(-0.01, 0.01, vScreenPosition.x);
  
  //gl_FragColor = vec4(mix(t_normal, world_normal, blend) * vec3(1.0, 1.0, 1.0), 1.0);
  //return;
  
  //vec3 world_normal = normalize((uWorldMatrix * vec4(t_normal, 0.0)).xyz);
  //vec3 world_normal = normalize((uWorldMatrix * vec4(aNormal, 0.0)).xyz);
  
  float star_exposure = min(dot(world_normal, star_direction), dot(vWorldNormal, star_direction));

  //gl_FragColor = vec4(vec3(1.0) * star_exposure, 1.0);
  //return;
  vec3 star_brightness = pow(clamp(star_exposure, 0.0, 1.0), 1.0) * uStarColor;
  star_brightness = star_brightness * 0.9 + 0.1;

  float len = sqrt(pow(vPosition.x, 2.0) + pow(vPosition.z, 2.0));
  vec3 reflection_direction = reflect(star_direction, vWorldNormal);

  vec3 t_landinfo = textureCube(uLandinfoCube, normalize(vNormal)).rgb;
  //vec3 t_color = texture2D(uTexture, coordinates).rgb;

  vec3 t_color = textureCube(uColorCube, normalize(vNormal)).rgb;

  float cloud_cover = t_landinfo.b;

  vec3 land_color = uLandColor;

  vec3 color = mix(uOceanColor, t_color, t_landinfo.r);

  vec3 diffuse = color * star_brightness;
  vec3 specular = vec3(0.5) * pow(clamp(dot(reflection_direction, view_direction), 0.0, 1.0), 12.0) * (1.0 - t_landinfo.r);

  //t_landinfo = texture2D(uLandinfo, coordinates, pow(cloud_cover, 1.5) * 1.0).rgb;
  
  vec3 night = uNightColor * t_landinfo.g * clamp(pow(-star_exposure, 0.5), 0.0, 1.0);

  color = diffuse + specular + night;

  vec3 cloud_color = vec3(1.0) * pow(clamp(star_exposure, 0.0, 1.0), 0.6);//cloud_cover;

  color = mix(color, vec3(0.0), t_landinfo.b);
  
  vec3 cloud_shadow_coord = normalize(vNormal + normalize((uWorldMatrix_i * vec4(star_direction, 0.0)).xyz) * -0.01);
  float cloudshadow = textureCube(uLandinfoCube, cloud_shadow_coord).b;

  color = mix(color, cloud_color, pow(cloudshadow, 0.75));
  
  gl_FragColor = vec4(color, 1.0);
}
