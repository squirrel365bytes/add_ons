function squirrelHelper() {

    let _debug = false;

    let _ifid = 'Nothing to see here.'

    let _size;
    let _position;
    let _runtimeMode;
    let _canvas;
    let _state;
    let _bindingDimensions;

    /**
     * this is the object returned by the squirrelHelper. It is a DOM element so that it inherits message send / receive capabilities
     */
    const _returnObject = document.createElement('squirrel');

    /**
    * "class" to handle Squirrel messages
    */
    function SquirrelMessage(id, name, value) {
        if (id != null) { this.id = id; }
        if (name != null) { this.name = name; }
        if (value != null) { this.value = value; }
    }

    /**
   * get the value for a URL query string parameter
   * @param name the name of the URL query parameter to get the value for
   * @returns the value of the query parameter
   */
    function getParameterByName(name) {
        const url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);

        if (!results) { return ''; }
        if (!results[2]) { return ''; }
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    /**
     * Called if an unexpected message is received from Squirrel
     * @param message the whole message body received
     */
    function catchAllMessageReceived(message) {
        if (_debug) {
            console.log('CHILD - unknown message received', message);
        }
    }

    /**
     * Method used to update the widgets local copy of state using a property string
     * @param property string to check
     * @param data value to check for changes
     * @returns updates the local state for the property and return bool as to whether it found and updated the value
     */
    function updatePropertyState(property, data) {
        const propertyArray = property.split('.');
        let subState = _state;
        propertyArray.forEach((value, index) => {
            if (subState && index < propertyArray.length - 1) {
                subState = subState[value];
            }
        });
        if (subState) {
            const subProperty = propertyArray[propertyArray.length - 1];
            subState[subProperty] = data;
            return true;
        }
        return false;
    }

    /**
     * event handler for messages from Squirrel
     * event.name is the name of the message
     * event.value is the value of the message
     */
    function messageHandler(event) {
        if (event.data.id == _ifid) {
            const message = event.data;

            switch (message.name) {
                case 'setSize':
                    // call size changes method
                    _size = message.value;
                    onSetSize(_size);
                    break;
                case 'setPosition':
                    // call position changes method
                    _position = message.value;
                    onSetPosition(_position);
                    break;
                case 'setRuntimeMode':
                    // call runtimeMode changes method
                    _runtimeMode = message.value;
                    onSetRuntimeMode(_runtimeMode);
                    break;
                case 'setCanvas':
                    // call size changes method
                    _canvas = message.value;
                    onSetCanvas(_canvas);
                    break;
                case 'initState':
                    // send copy of whole dymanic state, binding dimensions and size details
                    // value = {dynamicState, bindingDimensions, size}
                    _state = message.value.dynamicState ?? {};
                    _size = message.value.size;
                    _position = message.value.position;
                    _bindingDimensions = message.value.bindingDimensions ?? {};
                    _runtimeMode = message.value.runtimeMode;
                    _canvas = message.value.canvas;
                    onInitState(getCopyOfState());
                    break;
                case 'propertyChange':
                    // called once for each property that has changed
                    // message.value = {'property':'blaa.color.0.color', 'value': '#12345', dimension: {"width":1,"height":1}}

                    // if it has a dimension property then we need to update our binding dimension for the property
                    if (message.value.hasOwnProperty('dimension') && _bindingDimensions != null) {
                        _bindingDimensions[message.value.propery] = message.value.dimension;
                    }

                    // handle processing and updating state for these specific properties
                    if (updatePropertyState(message.value.property, message.value.value)) {
                        onPropertyChange(message.value.property, message.value.value);
                    }
                    break;
                case 'propertyChangesComplete':
                    // called at the end of the latest batch of 1 or more propertyChange events
                    onPropertyChangesComplete();
                    break;
                default:
                    catchAllMessageReceived(message);
                    break;
            }
        }
    }

    /**
     * Initialises the add-on and posts the DOMREADY message to the parent.
     * @param spoofResponse default false, if true will not send DOMREADY to Squirrel, instea will simulate a response back.  Useful when developing
     */
    function initWithSquirrel() {
        if (_debug) {
            console.log('CHILD - Add-on initialised');
            console.log('CHILD - DOMREADY');
        }
        // set the internal IFID tag
        _ifid = getParameterByName('ifid');

        // send DOMREADY to Squirrel
        if (_ifid != null && _ifid !== '') {
            parent.postMessage({ 'id': _ifid, 'message': 'DOMREADY' }, '*');
        }
    }

    /**
     * Used to send data to the parent.
     * 
     * Single value is a string
     * Multi value is a multi-dimensional array  eg 2 x 2 = [["Row 1 Column 1", "Row 1 Column 2"],["Row 2 Column 1", "Row 2 Column 2"]
     * 
     * @param property the property to update in state  eg buttonColor.colour.0.color
     * @param value the value or multi-dimension array of data to send to parent
     * @param padData If true, the data sent to Squirrel will match the dimensions of the binding range.  Padding with nulls if necessary
     */
    function sendToSquirrel(property, value, padData = true) {
        // check to see if the value is different, if not do not send message
        let data = value;
        if (padData) {
            const dim = getBindingDimension(property);
            // TODO need to validate string for arrays 
            if (dim != null) {
                data = convertToSquirrelArrayOfSize(value, dim.width, dim.height)
            } else {
                console.log(`CHILD - Warning, ${property} binding not found`);
            }
        }
        if (updatePropertyState(property, data)) {
            const message = new SquirrelMessage(_ifid, property, data);
            if (_debug) { console.log('CHILD - sending message to parent', message) }
            parent.postMessage(message, '*');
        } else {
            if (_debug) { console.log('CHILD - message not sent as value the same', property, data) }
        }
    }

    function parseColor(color, alpha = 1, outputHex = false) {
        const defaultColor = '#000000';
        const newAlpha = this.checkDecimal(alpha);
        const newColor = (typeof color === 'string') ? color : defaultColor;
        const w3c = w3color(newColor, null);
        w3c.opacity = newAlpha;
        if (outputHex) {
          let hex = w3c.toHexString();
          if (newAlpha < 1) {
             
            const alphaString = Math.floor(newAlpha * 255) < 16 ? '0' + (Math.floor(newAlpha * 255).toString(16)) : (Math.floor(newAlpha * 255).toString(16));
            hex += String(alphaString);  // if alpha then add to hex string
          }
          return hex;
        }
        return w3c.toRgbaString();
      }

    /**
     * Apply a 30% tint to a colour. 
     * @param color The colour to apply the tint to
     * @param alpha The opacity of the colour
     * @returns an RGBA string of the new colour
     */
    function tintColor(color, alpha = 1) {
        const defaultColor = '#000000';
        const newAlpha = checkDecimal(alpha);
        const newColor = (typeof color === 'string') ? color : defaultColor;
        const w3c = w3color(newColor, null);
        w3c.opacity = newAlpha;
        w3c.lighter(30);
        return w3c.toRgbaString();
    }

    /**
     * Apply a 30% shade to a colour. 
     * @param color The colour to apply the shade to
     * @param alpha The opacity of the colour
     * @returns an RGBA string of the new colour
     */
    function shadeColor(color, alpha = 1) {
        const defaultColor = '#000000';
        const newAlpha = checkDecimal(alpha);
        const newColor = (typeof color === 'string') ? color : defaultColor;
        const w3c = w3color(newColor, null);
        w3c.opacity = newAlpha;
        w3c.darker(30);
        return w3c.toRgbaString();
    }

    /**
     * Used to convert percentages to decimals.  eg 50% to 0.5
     * @param value the number to check
     * @returns the decimal value
     */
    function checkDecimal(value) {
        return (value > 1) ? value / 100 : value;
    }

    /**
     * Pads out the array to match the dimensions of the last array passed to Squirrel.
     * @param data Json Array in
     * @param width Min size to pad the array upto
     * @param height Min size to pad the array upto
     * @returns array matching the dimensions of the last array passed to Squirrel
     */
    function convertToSquirrelArrayOfSize(data, width, height) {
        //expands the theArray with null entries to become newRows x newCols in sizes

        // check to see if data is an array
        // if not then check to see what the binding dimension is
        // if 1 x 1 then return the string back as the binding will be for a single value
        // if not 1 x 1 then convert data to array to build up correct multi-dim array structure
        if (!Array.isArray(data)) {
            if (width === 1 && height === 1) {
                return data;
            } else {
                data = [[data]];
            }
        }

        // if dimensions are 1 x 1 then make sure it's a primitive value
        if (width === 1 && height === 1 && Array.isArray(data)) {
            // flatten multi dimensional array into a single array, and get first element for the first cell
            return data.flat(Infinity)[0];
        }

        let newWidth = 0;
        for (let row = 0; row < data.length; row++) {
            // loop through each row
            if ((width - data[row].length) > 0) {
                // if number of columns is fewer than requested width add more columns on
                data[row] = data[row].concat([...Array(width - data[row].length)]);
            } else if (data[row].length - width > 0) {
                // if the number of columns is greate than requested,  remove the redundant columns
                data[row].splice(-(data[row].length - width));
            }
            newWidth = data[row].length;
        }

        // check to see if the number of rows matches the requested height
        if (data.length < height) {
            // add rows if too few
            for (let i = data.length; i < height; i++) {
                data[i] = [...Array(newWidth)]
            }
        } else if (data.length > height) {
            //remove rows if too many.
            data.splice(height - data.length)
        }

        return data;
    }

    /**
     * Get a readonly copy of state
     * @returns the clone of state
     */
    function getCopyOfState() {
        return JSON.parse(JSON.stringify(_state));
    }

    /**
     * Get the current size of the component in Squirrel
     * @returns size object
     */
    function getSize() {
        return _size;
    }

    /**
     * Get the current position of the component on the Squirrel canvas
     * @returns position object
     * Added in build 1.12.x
     */
    function getPosition() {
        return _position;
    }

    /**
     * Get the current runtime mode of the component on the Squirrel canvas
     * @returns string
     * Added in build 1.12.x
     */
    function getRuntimeMode() {
        return _runtimeMode;
    }

    /**
     * Get the current size and color of the Squirrel canvas
     * @returns canvas object
     * Added in build 1.12.x
     */
    function getCanvas() {
        return _canvas;
    }

    /**
     * Sets the size of the component in Squirrel
     * @param size  
     * Added in build 1.12.x
     */
    function setSize(width, height) {
        const size = { width: width, height: height };
        const message = new SquirrelMessage(_ifid, 'size', size);
        if (_debug) { console.log('CHILD - sending rezise message to parent', size) }
        parent.postMessage(message, '*');
    }

    /**
     * Sets the position of the component on the Squirrel canvas
     * @param position 
     * Added in build 1.12.x
     */
    function setPosition(x, y) {
        const position = { x: x, y: y };
        const message = new SquirrelMessage(_ifid, 'position', position);
        if (_debug) { console.log('CHILD - sending position message to parent', position) }
        parent.postMessage(message, '*');
    }

    /**
     * Returns the width and height of the Squirrel bindings for a selected property
     * @param property the dot notation reference for the property e.g. buttonColor.color.0.color
     * @returns the height and width of the binding
     */
    function getBindingDimension(property) {
        return _bindingDimensions[property];
    }

    /**
     * Used to turn a property with array positions into a generic property name for doing check against
     * @param property dot notation property to convert   eg series.0.enabled
     * @returns property with indexes changed to *   eg series.*.series
     */
    function getGenericProperty(property) {
        let propertyArray = property.split('.');
        propertyArray = propertyArray.map((value) => {
            if (!isNaN(value)) {
                value = '*';
            }
            return value;
        });
        return propertyArray.join('.');
    }

    /**
     * Called when a setPosition event is received from Squirrel
     * @param position the position object passed in from the message handler
     * Added in build 1.12.x
     */
    function onSetPosition(position) {
        if (_debug) {
            console.log('CHILD - setPosition message received', position);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onSetPosition', position: position}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    /**
     * Called when a setSize event is received from Squirrel
     * @param size the size object passed in from the message handler
     */
    function onSetSize(size) {
        if (_debug) {
            console.log('CHILD - setSize message received', size);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onSetSize'}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    /**
     * Called when a setRuntimeMode event is received from Squirrel
     * @param mode the mode string passed in from the message handler
     * Added in build 1.12.x
     */
    function onSetRuntimeMode(mode) {
        if (_debug) {
            console.log('CHILD - setRuntimeMode message received', mode);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onSetRuntimeMode', mode: mode}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    /**
     * Called when a setCanvas event is received from Squirrel
     * @param canvas the canvas structure passed in from the message handler
     * Added in build 1.12.x
     */
    function onSetCanvas(canvas) {
        if (_debug) {
            console.log('CHILD - setCanvas message received', canvas);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onSetCanvas', canvas: canvas}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail}));

    }

    /**
     * Called when an initState event is recevied from Squirrel.
     * @param state a copy of the whole of the addon's state
     */
    function onInitState(state) {
        if (_debug) {
            console.log('CHILD - onInitState message received', state);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onInitState', state: state}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    /**
     * Called when a property change event is recevied from Squirrel.
     * @param property the property name which changed
     * @param value the value the property changed to
     */
    function onPropertyChange(property, value) {
        if (_debug) {
            console.log('CHILD - onPropertyChange message received', property, value);
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onPropertyChange', property: property, value: value}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    /**
     * Called at the end of a series of property value changes.  This can be called
     * either when a single or multiple values change at once.  This is the flag to say
     * There are no more incoming value changs to process at this time.
     */
    function onPropertyChangesComplete() {
        if (_debug) {
            console.log('CHILD - propertyChangesComplete message received');
            console.warn('CHILD - don\'t forget to handle event to process incoming messages');
        }
        const detail = {name:'onPropertyChangesComplete'}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    //setup the main message event listenr to listen to messages from Squirrel
    window.addEventListener('message', messageHandler);

    /**
    * expose the required propoeries to the retunred squirrelHelper object
    */

    //functions
    _returnObject.initWithSquirrel = initWithSquirrel;
    _returnObject.sendToSquirrel = sendToSquirrel;
    _returnObject.setSize = setSize;
    _returnObject.getSize = getSize;
    _returnObject.setPosition = setPosition;
    _returnObject.getPosition = getPosition;
    _returnObject.getCanvas = getCanvas;
    _returnObject.getRuntimeMode = getRuntimeMode;
    _returnObject.getCopyOfState = getCopyOfState;
    _returnObject.getGenericProperty = getGenericProperty;

    return _returnObject
}
const Squirrel = new squirrelHelper();

