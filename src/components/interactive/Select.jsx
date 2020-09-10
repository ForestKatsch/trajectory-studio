
import React from 'react';

import './Select.css';

import SelectSVG from './Select.svg';

class Select extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {open: false};

    // This binding is necessary to make `this` work in the callback
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState(state => ({
      checked: !state.checked
    }));

    /*
    if('onChange' in this.props) {
      this.props.onChange(!this.state.checked, this);
    }
    */
  }

  render() {
    /*
    React.Children.map(this.props.children, (child) => {
      console.log(child);
    });
    */
    
    return (
      <div className={`Select ${this.state.open ? 'Select--open' : ''} ${this.props.fill ? 'Select--fill' : ''}`}>
        <span className="Select__button" onClick={this.handleClick}>
          <span className="Select__button-label">{this.props.label}</span>
          <span className="Select__arrow" dangerouslySetInnerHTML={{__html: SelectSVG}}></span>
        </span>
      </div>
    );
  }
}

export default Select;
