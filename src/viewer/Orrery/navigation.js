
import Logger from 'js-logger';

import {vec2} from 'gl-matrix';

// This isn't rocket science.
function cloneValues(values) {
  return JSON.parse(JSON.stringify(values))
}

// # `Input`
//
// The Input class contains a set of `values` that can be updated by events on the `element`.
// If a value is `null`, it's considered to be 'uncontrolled'. For example,
// if a key is pressed, the value is set to 1; if the key is released, the value is set to `null`.
// It's not the input's job to resolve these; it's the job of the `MultiInput`.
export class Input {
  
  constructor() {
    this.parent = null;
    this.element = null;

    this.values = {};

    this.children = [];
  }

  // Sets a value to `value`.
  set(name, value) {
    if(name in this.values) {
      this.values[name] = value;
    } else {
      Logger.warn(`Input does not contain value named '${name}' (attempted to set to '${value}')`, this);
    }
  }

  add(input) {
    this.children.push(input);

    input.parent = this;
    input.element = this.element;

    // We don't want a reference to our values object, or it might (will) get clobbered.
    input.values = cloneValues(this.values);
    
    input.init();
  }

  getValues() {
    let values = cloneValues(this.values);

    if(this.children.length === 0) {
      return values;
    }

    for(let key of Object.keys(values)) {
      values[key] = null;
    }
    
    this.children.forEach((input) => {
      let child_values = input.getValues();

      for(let key of Object.keys(this.values)) {
        if(child_values[key] !== null) {
          values[key] = child_values[key];
        }
      }
    });

    return values;
  }

  resetValues() {
    for(let key of Object.keys(this.values)) {
      this.values[key] = null;
    }
    
    this.children.forEach((input) => {
      input.resetValues();
    });
  }
  
  destroy() {
    for(let input of this.children) {
      input.destroy();
    }

    this.children = []
  }

}

export class MouseInput extends Input {

  init() {
    this.handleWheel = this.handleWheel.bind(this);

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    
    this.handleMouseOut = this.handleMouseOut.bind(this);

    this.element.addEventListener('wheel', this.handleWheel, {passive: true});
    
    this.element.addEventListener('mousedown', this.handleMouseDown);
    this.element.addEventListener('mousemove', this.handleMouseMove);
    this.element.addEventListener('mouseup', this.handleMouseUp);
    
    window.addEventListener('mouseout', this.handleMouseOut);
    window.addEventListener('blur', this.handleMouseOut);

    this.down_position = vec2.create();
    this.position = vec2.create();
    this.delta = vec2.create();
    
    this.down = false;
    this.dragging = false;
  }

  handleWheel(event) {
    let delta = event.deltaY;

    this.set('zoom', delta);
  }

  handleMouseDown(event) {
    vec2.set(this.down_position, event.clientX, event.clientY);
    vec2.copy(this.position, this.down_position);
    
    this.down = true;
  }

  resetValues() {
    super.resetValues();

    vec2.set(this.delta, 0, 0);
  }
  
  handleMouseMove(event) {
    if(!this.down) {
      return;
    }
    
    let current_position = vec2.fromValues(event.clientX, event.clientY);
    let delta = vec2.create();
    vec2.subtract(delta, this.position, current_position);
    vec2.add(this.delta, this.delta, delta);

    vec2.copy(this.position, current_position);

    this.set('heading', this.delta[0]);
    this.set('pitch', this.delta[1]);
  }
  
  handleMouseUp(event) {
    this.down = false;
  }
  
  handleMouseOut(event) {
    this.down = false;
  }
  
}

export class TouchInput extends Input {

  init() {
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    
    this.element.addEventListener('touchstart', this.handleTouchStart);
    this.element.addEventListener('touchmove', this.handleTouchMove);
    this.element.addEventListener('touchend', this.handleTouchEnd);
    this.element.addEventListener('touchcancel', this.handleTouchEnd);
    
    window.addEventListener('blur', this.handleBlur);

    this.down_position = vec2.create();
    this.position = vec2.create();
    this.delta = vec2.create();
    
    this.down = false;
    this.dragging = false;
  }

  getAverage(touches) {
    touches = [...touches];

    let average = vec2.create();

    touches.forEach((touch) => {
      vec2.add(average, average, [touch.clientX, touch.clientY]);
    });

    vec2.scale(average, 1 / touches.length);

    return average;
  }

  handleTouchStart(event) {
    vec2.copy(this.down_position, this.getAverage(event.changedTouches));
    vec2.copy(this.position, this.down_position);

    this.down = true;
  }
  
  handleTouchMove(event) {
    if(!this.down) {
      return;
    }
    
    let current_position = this.getAverage(event.changedTouches);

    vec2.subtract(this.delta, this.position, current_position);

    vec2.copy(this.position, current_position);

    console.log(this.delta);
    
    this.set('heading', this.delta[0]);
    this.set('pitch', this.delta[1]);
  }
  
  handleTouchEnd(event) {
    this.down = false;
  }
  
  handleBlur(event) {
    this.down = false;
  }
  
}

export class SmoothInput extends Input {

  constructor(options) {
    super();

    this.smoothing = {};

    this.last_sample_time = -1;
  }

  init() {
    this.smooth_values = cloneValues(this.values);

    for(let key of Object.keys(this.values)) {
      this.smooth_values[key] = 0;
    }
  }

  getValues() {
    let new_values = super.getValues();

    let elapsed = 0.01;
    let now = Date.now() / 1000;

    if(this.last_sample_time > 0) {
      elapsed = Math.min(this.last_sample_time - now, 0.2);
    }

    elapsed = 1 / 60;
    
    this.last_sample_time = now;

    for(let key of Object.keys(this.smooth_values)) {
      let new_value = new_values[key];

      let parameters = {
        enabled: true,
        smoothing: 0.1,
      };

      if(key in this.smoothing) {
        if(!this.smoothing[key]) {
          parameters.enabled = false;
        } else {
          parameters = {
            ...parameters,
            ...this.smoothing[key]
          };
        }
      }

      if(new_value === null || new_value === undefined) {
        new_value = 0;
      }

      if(!parameters.enabled) {
        this.smooth_values[key] = new_value;
        continue;
      }

      this.smooth_values[key] += (new_value - this.smooth_values[key]) * (1-Math.pow(0.5, elapsed * parameters.smoothing));
    }

    return this.smooth_values;
  }

}

export default class Navigation {

  constructor(element) {
    this.input = new SmoothInput();
    this.input.element = element;
    
    this.input.values = {
      pitch: 0,
      heading: 0,
      zoom: 0
    };

    this.input.smoothing = {
      zoom: { smoothing: 30 },
      heading: { smoothing: 30 },
      pitch: { smoothing: 30 }
    };
    
    this.input.init();
    
    //this.input.add(new TouchInput());
    this.input.add(new MouseInput());
  }
  
  getValues() {
    return this.input.getValues();
  }

  resetValues() {
    return this.input.resetValues();
  }

  destroy() {
    this.input.destroy();
  }

}
