precision highp float;

uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform vec3 uNightColor;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform sampler2D uTexture;
uniform sampler2D uLandinfo;

uniform mat4 uViewMatrix_i;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewNormal;

const float PI = 3.141592653;
const float PI_2 = 6.28318530;

#import "./include.glsl";

void main() {
  vec3 view_direction = getViewDirection();
  vec3 star_direction = getStarDirection();
  
  float star_exposure = dot(vWorldNormal, star_direction);
  vec3 star_brightness = pow(clamp(star_exposure, 0.0, 1.0), 1.0) * uStarColor;
  star_brightness = star_brightness * 0.95 + 0.05;

  float len = sqrt(pow(vPosition.x, 2.0) + pow(vPosition.z, 2.0));
  vec3 reflection_direction = reflect(star_direction, vWorldNormal);

  vec2 coordinates = vec2(
                          (atan(vPosition.x, vPosition.z)) / PI_2 + 0.5,
                          atan(len, vPosition.y) / PI);

  vec3 t_landinfo = texture2D(uLandinfo, coordinates).rgb;
  vec3 t_color = texture2D(uTexture, coordinates).rgb;

  float cloud_cover = t_landinfo.b;

  vec3 land_color = uLandColor;

  vec3 color = mix(uOceanColor, t_color, t_landinfo.r);

  vec3 diffuse = color * star_brightness;
  vec3 specular = vec3(0.5) * pow(clamp(dot(reflection_direction, view_direction), 0.0, 1.0), 2.0) * (1.0 - t_landinfo.r);

  t_landinfo = texture2D(uLandinfo, coordinates, pow(cloud_cover, 1.5) * 1.0).rgb;
  
  vec3 night = uNightColor * t_landinfo.g * clamp(pow(-star_exposure, 0.5), 0.0, 1.0);

  color = diffuse + specular + night;

  vec3 cloud_color = vec3(1.0) * pow(clamp(star_exposure, 0.0, 1.0), 0.75);//cloud_cover;

  color = mix(color, cloud_color, cloud_cover);
  
  gl_FragColor = vec4(color, 1.0);
}
