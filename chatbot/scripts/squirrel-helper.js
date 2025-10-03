function squirrelHelper() {

    let _debug = false;

    let _ifid = 'Nothing to see here.'

    let _size;
    let _position;
    let _runtimeMode;
    let _canvas;
    let _state;
    let _bindingDimensions;

    const _returnObject = document.createElement('squirrel');

    function SquirrelMessage(id, name, value) {
        if (id != null) { this.id = id; }
        if (name != null) { this.name = name; }
        if (value != null) { this.value = value; }
    }

    function getParameterByName(name) {
        const url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);

        if (!results) { return ''; }
        if (!results[2]) { return ''; }
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    function catchAllMessageReceived(message) {
        if (_debug) {
            console.log('CHILD - unknown message received', message);
        }
    }

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

    function messageHandler(event) {
        if (event.data.id == _ifid) {
            const message = event.data;

            switch (message.name) {
                case 'setSize':
                    _size = message.value;
                    onSetSize(_size);
                    break;
                case 'setPosition':
                    _position = message.value;
                    onSetPosition(_position);
                    break;
                case 'setRuntimeMode':
                    _runtimeMode = message.value;
                    onSetRuntimeMode(_runtimeMode);
                    break;
                case 'setCanvas':
                    _canvas = message.value;
                    onSetCanvas(_canvas);
                    break;
                case 'initState':
                    _state = message.value.dynamicState ?? {};
                    _size = message.value.size;
                    _position = message.value.position;
                    _bindingDimensions = message.value.bindingDimensions ?? {};
                    _runtimeMode = message.value.runtimeMode;
                    _canvas = message.value.canvas;
                    onInitState(getCopyOfState());
                    break;
                case 'propertyChange':
                    if (message.value.hasOwnProperty('dimension') && _bindingDimensions != null) {
                        _bindingDimensions[message.value.propery] = message.value.dimension;
                    }
                    if (updatePropertyState(message.value.property, message.value.value)) {
                        onPropertyChange(message.value.property, message.value.value);
                    }
                    break;
                case 'propertyChangesComplete':
                    onPropertyChangesComplete();
                    break;
                default:
                    catchAllMessageReceived(message);
                    break;
            }
        }
    }

    function initWithSquirrel() {
        _ifid = getParameterByName('ifid');
        if (_ifid != null && _ifid !== '') {
            parent.postMessage({ 'id': _ifid, 'message': 'DOMREADY' }, '*');
        }
    }

    function sendToSquirrel(property, value, padData = true) {
        let data = value;
        const message = new SquirrelMessage(_ifid, property, data);
        parent.postMessage(message, '*');
    }

    function getCopyOfState() { return JSON.parse(JSON.stringify(_state)); }
    function getSize() { return _size; }
    function getPosition() { return _position; }
    function getRuntimeMode() { return _runtimeMode; }
    function getCanvas() { return _canvas; }
    function getBindingDimension(property) { return _bindingDimensions[property]; }

    function getGenericProperty(property) {
        let propertyArray = property.split('.');
        propertyArray = propertyArray.map((value) => {
            if (!isNaN(value)) { value = '*'; }
            return value;
        });
        return propertyArray.join('.');
    }

    function onSetPosition(position) {
        const detail = {name:'onSetPosition', position: position}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }
    function onSetSize(size) {
        const detail = {name:'onSetSize'}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }
    function onSetRuntimeMode(mode) {
        const detail = {name:'onSetRuntimeMode', mode: mode}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }
    function onSetCanvas(canvas) {
        const detail = {name:'onSetCanvas', canvas: canvas}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail}));
    }
    function onInitState(state) {
        const detail = {name:'onInitState', state: state}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }
    function onPropertyChange(property, value) {
        const detail = {name:'onPropertyChange', property: property, value: value}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }
    function onPropertyChangesComplete() {
        const detail = {name:'onPropertyChangesComplete'}
        _returnObject.dispatchEvent(new CustomEvent('eventDispatch', { detail: detail }));
    }

    window.addEventListener('message', messageHandler);

    _returnObject.initWithSquirrel = initWithSquirrel;
    _returnObject.sendToSquirrel = sendToSquirrel;
    _returnObject.setSize = ()=>{};
    _returnObject.getSize = getSize;
    _returnObject.setPosition = ()=>{};
    _returnObject.getPosition = getPosition;
    _returnObject.getCanvas = getCanvas;
    _returnObject.getRuntimeMode = getRuntimeMode;
    _returnObject.getCopyOfState = getCopyOfState;
    _returnObject.getGenericProperty = getGenericProperty;

    return _returnObject
}
const Squirrel = new squirrelHelper();
