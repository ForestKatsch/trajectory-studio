
// # `Atmosphere`
//
// The most difficult part of any Elitedangerouslike game is the atmosphere. Definitely not anything else.
// So here's some functions to render atmospheres.

// Raycasting.

// Returns a vec4 containing <distance to start (sphere entry)>, <distance from entry (or camera) to exit>, <angle-of-incidence>, <chord length>
//
// If the ray does not intersect the sphere, the X value is negative.
// Assumes the planet is at the origin.
//
// ```
//              __________
// |<----tca---/--->|     \
// point->----S-----*------E---
//      dir  /   ^  |       \
//          |    |  |<-+     |
//          |    | 0,0 |     |
//          |    |     |     |
//          |   thc    d     |
//           \              /
//            \            /
//             \_________ /
//
// ```
//
// where `point`, `dir`, `tca`, and `thc` are all self-explanatory.
//
// `d` is the length between `[0, 0]` and the closest point along the ray;
// `thc` is half the length of the line from the starting point to the exit point;
// and `S`/`E` are the start and exit points, respectively.
//
// The values returned are:
// * `x`: the entry point (start) of the ray.
// * `x`: the entry point (start) of the ray or the camera position, whichever is closer to the end point.
// * `y`: the length of the ray from start to end or from the camera position to the end, whichever is closer.
// * `z`: the angle between the ray at `start` and the surface of the sphere.
//   A value of `1rad` means the ray is glancing, and `0rad` means the ray directly passes through the center of the sphere.
// * `w`: the length of the ray, from start to end, ignoring camera position.
//
// If the ray does not intersect the sphere, `x` and `y` are set to `-1.0`.
// The angle is always returned, since it is valid even if the ray did not intersect the sphere (it just returns `1rad`.)
vec4 raySphereDistance(vec3 point, vec3 dir, float radius) {
  float radius2 = radius * radius;
  
  float tca = -dot(point, dir);

  float d2 = dot(point, point) - (tca * tca);

  float thc = sqrt(radius2 - d2);

  float angle = atan(sqrt(d2), thc) / 1.57079;
  
  float start = tca - thc;
  float end = tca + thc;

  if(d2 > (radius2)) {
    return vec4(-1.0, -1.0, angle, 0.0);
  }

  if(end < 0.0) {
    return vec4(-1.0, -1.0, angle, 0.0);
  }

  return vec4(start, end - max(start, 0.0), angle, thc * 2.0);
}

// Altitude is a floating-point value from 0..1 (where 0 is ground and 1 is sky.)
// Returns a value from 0..1, using the density curve specified in `param_atmosphere`.
float atmosphereDensityAtAltitude(float altitude, vec4 param_atmosphere) {
  return exp(-clamp(altitude, 0.0, 1.0) * param_atmosphere.z) * (1.0 - altitude);
}

// Returns the density of the atmosphere at a given point.
// Determines the altitude of the point (as a fraction of the distance from the planet
// surface to the outer edge of the atmosphere), then calls the above function to calculate
// the density itself.
float atmosphereDensityAtPoint(vec3 position, vec4 param_atmosphere) {
  float atmosphere_height = param_atmosphere.y - param_atmosphere.x;
  float altitude = (length(position) - param_atmosphere.x) / atmosphere_height;

  return atmosphereDensityAtAltitude(altitude, param_atmosphere);
}

const int OPTICAL_DEPTH_STEPS = 8;

// Returns the optical depth of a ray.
// TODO: optimize this with a texture lookup.
float atmosphereOpticalDepth(vec3 position, vec3 direction, float ray_length, vec4 param_atmosphere) {
  vec3 point = position;
  float step_size = ray_length / float(OPTICAL_DEPTH_STEPS - 1);
  float opticalDepth = 0.0;

  for(int i=0; i<OPTICAL_DEPTH_STEPS; i++) {
    point = position + direction * step_size * float(i);
    opticalDepth += atmosphereDensityAtPoint(point, param_atmosphere) * step_size;
  }

  return opticalDepth;
}

const int SCATTERING_STEPS = 8;

// Calculates the color along the ray given by `position` and `direction`.
// All coordinates and positions are in model-space, and assume the planet is at [0, 0].
//
// Inputs:
// * `position`: this is the model-space position of the camera. This will function properly within the atmosphere,
//   provided the atmosphere mesh uses inverted normals.
// * `direction`: the direction of the view.
// * `dir_star`: the model-space normalized vector pointing at the star.
// * `color_star`: the color of the star.
// * `param_atmosphere`: atmosphere parameters. X = planet radius, Y = atmosphere radius, Z = atmosphere density curve
//   (higher numbers produce a thinner atmosphere), and W = mie scattering strength.
// * `param_raleigh`: raleigh scattering color. R, G, and B define the scattering strengths of the R, G, and B colors; higher numbers
//   produce darker colors for that channel. A is the mie power curve; higher numbers here produce a smaller mie effect.
vec3 atmosphereColorRay(vec3 position, vec3 direction, float length_ray, vec3 dir_star, vec3 color_star, vec4 param_atmosphere, vec4 param_raleigh, float sample_curve) {
  sample_curve = min(sample_curve, 0.999);
  float planetRadius = param_atmosphere.x;
  float atmosphereRadius = param_atmosphere.y;
  
  // The total atmosphere color visible at `position`.
  vec3 color = vec3(0.0);

  float frac_point = 0.0;
  float div = 1.0 / (1.0 - pow(sample_curve, float(SCATTERING_STEPS)));

  float total_length = 0.0;

  for(int i=0; i<=SCATTERING_STEPS; i++) {
    float frac_pointNew = (1.0 - pow(sample_curve, float(i + 1))) * div;
    float length_stepSize = (frac_pointNew - frac_point) * length_ray;

    total_length += length_stepSize;

    // The point in the atmosphere, in model space.
    vec3 pos_sample = position + direction * (frac_point * length_ray);
    
    frac_point = frac_pointNew;

    // The distance through the atmosphere to the star.
    // Note that this assumes the planet is a uniform spherical ball of atmosphere below the planet.
    float length_starAtmosphere = max(raySphereDistance(pos_sample, dir_star, atmosphereRadius).y, 0.0);

    // Cast a ray against the planet towards the sun.
    // (This shadowing didn't seem to have a big impact on the appearance of the planet, despite
    // costing an additional raycast, so I've removed it.)
    // vec3 ray_starPlanet = raySphereDistance(pos_sample, dir_star, planetRadius);
    // How much of the sun is hitting this sample, from 0..1.
    
    // The optical depth (= approximate density) of the atmosphere along the ray towards the star.
    float star_ray_optical_depth = atmosphereOpticalDepth(pos_sample, dir_star, length_starAtmosphere, param_atmosphere);
    float view_ray_optical_depth = atmosphereOpticalDepth(pos_sample, -direction, length_stepSize, param_atmosphere);

    // Mie scattering. Essentially a power curve when we're between the viewer and the sun.
    float frac_mie = param_atmosphere.w * pow(max(dot(dir_star, direction), 0.0), param_raleigh.w);
    
    vec3 transmittance = exp(-(star_ray_optical_depth + view_ray_optical_depth) * param_raleigh.rgb) * color_star;

    // Density of this point in the atmosphere, from 0..1.
    float frac_density = atmosphereDensityAtPoint(pos_sample, param_atmosphere);
    
    color += frac_density * transmittance * param_raleigh.rgb * length_stepSize;
    color += frac_density * frac_mie * transmittance * length_stepSize;
  }

  return color;
}

// Returns the color of a point in the atmosphere. Ignores the planet for better blending.
vec3 atmosphereSkyColor(vec3 position, vec3 direction, vec3 dir_star, vec3 color_star, vec4 param_atmosphere, vec4 param_raleigh) {
  float atmosphereRadius = param_atmosphere.y;

  // Cast a ray through the atmosphere to determine the start point.
  vec4 ray_atmosphereView = raySphereDistance(position, direction, atmosphereRadius);

  // The starting point of the ray (i.e. where it intersects with the atmosphere.)
  // This is the entrance of the ray into the atmosphere, or the camera position, whichever is closer to the exit of the ray.
  vec3 pos_viewRayStart = position - direction * -max(ray_atmosphereView.x, 0.0);

  // The length of the ray, from `pos_viewRayStart` to the exit point.
  float length_viewRay = max(ray_atmosphereView.y, 0.0);

  return atmosphereColorRay(pos_viewRayStart, direction, length_viewRay, dir_star, color_star, param_atmosphere, param_raleigh, 0.98);
}

// Returns the color of a point on the planet's surface.
vec3 atmospherePlanetColor(vec3 position, vec3 direction, vec3 dir_star, vec3 color_star, vec4 param_atmosphere, vec4 param_raleigh, float sample_curve) {
  float planetRadius = param_atmosphere.x;
  float atmosphereRadius = param_atmosphere.y;

  // Cast a ray through the atmosphere to determine the start point.
  vec4 ray_atmosphereView = raySphereDistance(position, direction, atmosphereRadius);

  // The starting point of the ray (i.e. where it intersects with the atmosphere.)
  // This is the entrance of the ray into the atmosphere, or the camera position, whichever is closer to the exit of the ray.
  vec3 pos_viewRayStart = position - direction * -max(ray_atmosphereView.x, 0.0);

  // The length of the ray, from `pos_viewRayStart` to the exit point.
  float length_viewRay = max(ray_atmosphereView.y, 0.0);

  // And cast a ray through the planet, to see if we should terminate this ray at the planet instead of the atmosphere's exit position.
  vec4 ray_planetView = raySphereDistance(position, direction, planetRadius);
  
  // If the planet is in the way, the ray should be no longer than the radius of the planet.
  if(ray_planetView.y > 0.0) {
    length_viewRay = (ray_planetView.x - ray_atmosphereView.x) * 0.98;
  }

  return atmosphereColorRay(pos_viewRayStart, direction, length_viewRay, dir_star, color_star, param_atmosphere, param_raleigh, sample_curve);
}
