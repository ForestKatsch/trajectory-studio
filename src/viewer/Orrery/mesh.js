
import {vec3} from 'gl-matrix';

// TODO: support triangle strip generation with degenerate triangles.
// With a `divisions` value of `0`, the sphere will be a cube.
// With a `divisions` value of `1`, the sphere will have one dividing line.
// With a `divisions` value of `2`, the sphere will have two dividing lines (16 faces per side.)
export function createQuadsphere(renderer, name, divisions, inverted) {
  if(inverted === undefined) {
    inverted = false;
  }

  let sign = 1;

  if(inverted) {
    sign = -1;
  }
  
  divisions = divisions + 2;
  
  let mesh = renderer.createMesh(name);

  let data = {
    position: [],
    normal: [],
    _triangles: []
  };

  // Returns an object containing two keys: 'position', and 'triangles'.
  // The `vertex_function` is called with parameters `x` and `y`, and the value it returns
  // is directly appended to `vertices`.
  let createFace = (vertex_function) => {
    let d = {
      position: [],
      _triangles: []
    };

    for(let x=0; x<divisions; x++) {
      for(let y=0; y<divisions; y++) {
        let x_start = (x / divisions) - 0.5;
        let y_start = ((y / divisions) - 0.5) * sign;
        
        let x_end = ((x+1) / divisions) - 0.5;
        let y_end = (((y+1) / divisions) - 0.5) * sign;

        d.position.push(vertex_function(x_start, y_start));
        d.position.push(vertex_function(x_start, y_end));
        d.position.push(vertex_function(x_end, y_end));
        d.position.push(vertex_function(x_end, y_start));

        let t_idx = d.position.length - 4;

        d._triangles.push([t_idx + 2, t_idx + 1, t_idx + 0]);
        d._triangles.push([t_idx + 2, t_idx + 0, t_idx + 3]);
      }
    }

    return {
      position: d.position,
      _triangles: d._triangles.flat()
    };
  };

  let xp = createFace((x, y) => {
    return [0.5, x, y];
  });
  
  let xn = createFace((x, y) => {
    return [-0.5, -x, y];
  });

  let yp = createFace((x, y) => {
    return [-x, 0.5, y];
  });
  
  let yn = createFace((x, y) => {
    return [x, -0.5, y];
  });
  
  let zp = createFace((x, y) => {
    return [x, y, 0.5];
  });
  
  let zn = createFace((x, y) => {
    return [-x, y, -0.5];
  });

  let appendData = (a, b) => {
    a._triangles.push.apply(a._triangles, b._triangles.map((value) => {
      return a.position.length + value;
    }));

    for(let key of Object.keys(b)) {
      if(key === '_triangles') {
        continue;
      } else {
        a[key].push.apply(a[key], b[key]);
      }
    }
    
    return a;
  };

  data = appendData(data, xp);
  data = appendData(data, xn);

  data = appendData(data, yp);
  data = appendData(data, yn);

  data = appendData(data, zp);
  data = appendData(data, zn);

  data.position.forEach((position, index) => {
    vec3.normalize(data.position[index], data.position[index]);
    vec3.scale(data.position[index], data.position[index], 0.5);
  });
  
  data.normal = data.position.map((position, index) => {
    let normal = vec3.create();
    vec3.normalize(normal, position);

    if(inverted) {
      vec3.scale(normal, normal, -1);
    }
    
    return normal;
  });
  
  mesh.createMesh({
    aPosition: data.position,
    aNormal: data.normal
  }, data._triangles);
}

