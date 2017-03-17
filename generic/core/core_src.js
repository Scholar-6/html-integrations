var _wrs_popupWindow;

wrs_addEvent(window, 'message', function (e) {
    if (e.source = _wrs_popupWindow && typeof e.wrs_processed == 'undefined') {
        e.wrs_processed = true;
        var postVariable = {};
        postVariable.id = e.data.id;
        if (e.data.hasOwnProperty('methodName')) {
            var object = (e.data.objectName == null) ? this : window[e.data.objectName];
            postVariable.value = object[e.data.methodName].apply(object, e.data.arguments);
        } else {
            var postVariables = {};
            e.data.varNames.forEach(function(varName){
                postVariables[varName] = window[varName];
            });
            postVariable.value = postVariables;
        }
        if (typeof(e.source) != 'undefined') { // Avoid sent message when popupWindows has been closed.
            e.source.postMessage(postVariable, _wrs_conf_path);
        }
    }
});

/**
 * Fires an element event.
 * @param {object} element element where event should be fired.
 * @param {string} event event to fire.
 * @ignore
 */
function wrs_fireEvent(element, event) {
    if (document.createEvent){
        var eventObject = document.createEvent('HTMLEvents');
        eventObject.initEvent(event, true, true);
        return !element.dispatchEvent(eventObject);
    }

    var eventObject = document.createEventObject();
    return element.fireEvent('on' + event, eventObject)
}

wrs_addEvent(window, 'mouseup', function (e) {
    if (typeof(_wrs_modalWindow) !== 'undefined' && _wrs_modalWindow != null) {
        if (_wrs_modalWindow.properties.state != "maximized") {
            _wrs_modalWindow.overlayDiv.style.display = 'none';
        }
        wrs_fireEvent(_wrs_modalWindow.iframe.contentDocument, 'mouseup');
    }
});

// Vars.
var _wrs_currentPath = window.location.toString().substr(0, window.location.toString().lastIndexOf('/') + 1);
var _wrs_editMode = typeof _wrs_editMode != 'undefined' ? _wrs_editMode : undefined;
var _wrs_isNewElement = typeof _wrs_isNewElement != 'undefined' ? _wrs_isNewElement : true;
var _wrs_temporalImage;
var _wrs_temporalFocusElement;
var _wrs_range;

// LaTex client cache.
var _wrs_int_LatexCache = {};

// Accessible client cache.
var _wrs_int_AccessibleCache = {};

var _wrs_xmlCharacters = {
    'tagOpener': '<',       // Hex: \x3C.
    'tagCloser': '>',       // Hex: \x3E.
    'doubleQuote': '"',     // Hex: \x22.
    'ampersand': '&',       // Hex: \x26.
    'quote': '\''           // Hex: \x27.
};

var _wrs_safeXmlCharacters = {
    'tagOpener': '«',       // Hex: \xAB.
    'tagCloser': '»',       // Hex: \xBB.
    'doubleQuote': '¨',     // Hex: \xA8.
    'ampersand': '§',       // Hex: \xA7.
    'quote': '`',           // Hex: \x60.
    'realDoubleQuote': '¨'
};

var _wrs_safeXmlCharactersEntities = {
    'tagOpener': '&laquo;',
    'tagCloser': '&raquo;',
    'doubleQuote': '&uml;',
    'realDoubleQuote': '&quot;'
}

var _wrs_safeBadBlackboardCharacters = {
    'ltElement': '«mo»<«/mo»',
    'gtElement': '«mo»>«/mo»',
    'ampElement': '«mo»&«/mo»'
}

var _wrs_safeGoodBlackboardCharacters = {
    'ltElement': '«mo»§lt;«/mo»',
    'gtElement': '«mo»§gt;«/mo»',
    'ampElement': '«mo»§amp;«/mo»'
}

var _wrs_staticNodeLengths = {
    'IMG': 1,
    'BR': 1
}

// Backwards compatibily.

if (!(window._wrs_conf_imageClassName)) {
    _wrs_conf_imageClassName = 'Wirisformula';
}

if (!(window._wrs_conf_CASClassName)) {
    _wrs_conf_CASClassName = 'Wiriscas';
}

// Mutation observers to avoid wiris image formulas class be removed.
if (typeof MutationObserver != 'undefined') {
    var wrs_observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.oldValue == _wrs_conf_imageClassName && mutation.attributeName == 'class' && mutation.target.className.indexOf(_wrs_conf_imageClassName) == -1 ) {
                mutation.target.className = _wrs_conf_imageClassName;
            }
        });
    });

    var wrs_observer_config = { attributes: true, attributeOldValue:true };
}

// Plugin listeners for custom callbacks. This variable
// can be setted by the user using wrs_addPluginListener.
var wrs_pluginListeners = [];

var _wrs_css_loaded = false;

var _wrs_modalWindowProperties = typeof _wrs_modalWindowProperties != 'undefined' ? _wrs_modalWindowProperties : {};
var _wrs_editor = typeof _wrs_editor != 'undefined' ? _wrs_editor : null;
var _wrs_modalWindow = typeof _wrs_modalWindow != 'undefined' ? _wrs_modalWindow : null;

/**
 * Adds element events.
 * @param {object} target Target
 * @param {function} doubleClickHandler Function to run when user double clicks the element
 * @param {function} mousedownHandler Function to run when user mousedowns the element
 * @param {function} mouseupHandler Function to run when user mouseups the element
 * @ignore
 */
function wrs_addElementEvents(target, doubleClickHandler, mousedownHandler, mouseupHandler) {
    if (doubleClickHandler) {
        wrs_addEvent(target, 'dblclick', function (event) {
            var realEvent = (event) ? event : window.event;
            var element = realEvent.srcElement ? realEvent.srcElement : realEvent.target;
            doubleClickHandler(target, element, realEvent);
        });
    }

    if (mousedownHandler) {
        wrs_addEvent(target, 'mousedown', function (event) {
            var realEvent = (event) ? event : window.event;
            var element = realEvent.srcElement ? realEvent.srcElement : realEvent.target;
            _wrs_temporalFocusElement = element;
            mousedownHandler(target, element, realEvent);
        });
    }

    if (mouseupHandler) {
        wrs_addEvent(target, 'mouseup', function (event) {
            var realEvent = (event) ? event : window.event;
            var element = realEvent.srcElement ? realEvent.srcElement : realEvent.target;
            mouseupHandler(target, element, realEvent);
        });
    }
}

/**
 * Cross-browser addEventListener/attachEvent function.
 * @param {object} element Element target
 * @param {event} event Event
 * @param {function} func Function to run
 * @ignore
 */
function wrs_addEvent(element, event, func) {
    if (element.addEventListener) {
        element.addEventListener(event, func, true);
    }
    else if (element.attachEvent) {
        element.attachEvent('on' + event, func);
    }
}

/**
 * Adds iframe events.
 * @param {object} iframe Target
 * @param {function} doubleClickHandler Function to run when user double clicks the iframe
 * @param {function} mousedownHandler Function to run when user mousedowns the iframe
 * @param {function} mouseupHandler Function to run when user mouseups the iframe
 * @ignore
 */
function wrs_addIframeEvents(iframe, doubleClickHandler, mousedownHandler, mouseupHandler) {
    wrs_initSetSize();
    wrs_addElementEvents(iframe.contentWindow.document,
        function (target, element, event) {
            doubleClickHandler(iframe, element, event);
        },
        function (target, element, event) {
            mousedownHandler(iframe, element, event);
        },
        function (target, element, event) {
            mouseupHandler(iframe, element, event);
        }
    );
}

/**
 * Adds textarea events.
 * @param {object} textarea Target
 * @param {function} clickHandler Function to run when user clicks the textarea.
 * @ignore
 */
function wrs_addTextareaEvents(textarea, clickHandler) {
    if (clickHandler) {
        wrs_addEvent(textarea, 'click', function (event) {
            var realEvent = (event) ? event : window.event;
            clickHandler(textarea, realEvent);
        });
    }
}

/**
 * Converts applet code to img object.
 * @param {object} creator Object with "createElement" method
 * @param {string} appletCode Applet code
 * @param {string} image Base 64 image stream
 * @param {int} imageWidth Image width
 * @param {int} imageHeight Image height
 * @return object img object.
 * @ignore
 */
function wrs_appletCodeToImgObject(creator, appletCode, image, imageWidth, imageHeight) {
    var imageSrc = wrs_createImageCASSrc(image);
    var imgObject = creator.createElement('img');

    imgObject.src = imageSrc;
    imgObject.align = 'middle';
    imgObject.width = imageWidth;
    imgObject.height = imageHeight;
    imgObject.setAttribute(_wrs_conf_CASMathmlAttribute, wrs_mathmlEncode(appletCode));
    imgObject.className = _wrs_conf_CASClassName;

    return imgObject;
}

/**
 * Checks if a determined array contains a determined element.
 * @param {array} stack
 * @param {object} element
 * @return bool
 * @ignore
 */
function wrs_arrayContains(stack, element) {
    for (var i = stack.length - 1; i >= 0; --i) {
        if (stack[i] === element) {
            return i;
        }
    }

    return -1;
}

/**
 * Adds a specific className to given element
 * @param  {object} element
 * @param  {string} className
 * @ignore
 */
function wrs_addClass(element, className) {
    if (!wrs_containsClass(element, className)) {
        element.className += " " + className;
    }
}

/**
 * Checks if an element contains a class.
 * @param {object} element
 * @param {string} className
 * @return bool
 * @ignore
 */
function wrs_containsClass(element, className) {
    if (!('className' in element)) {
        return false;
    }

    var currentClasses = element.className.split(' ');

    for (var i = currentClasses.length - 1; i >= 0; --i) {
        if (currentClasses[i] == className) {
            return true;
        }
    }

    return false;
}

/**
 * Remove a specific class
 * @param {object} element
 * @param {string} className
 * @ignore
 */
function wrs_removeClass(element, className) {
    var newClassName = '';
    var classes = element.className.split(" ");

    for (var i = 0; i < classes.length; i++) {
        if(classes[i] != className) {
            newClassName += classes[i] + " ";
        }
    }
    element.className = newClassName.trim();
}

/**
 * Converts old xmlinitialtext attribute (with «») to the correct one(with §lt;§gt;)
 * @param {string} text String containtg safeXml characters
 * @return {string} String with the safeXml charaters parsed.
 * @ignore
 */
function wrs_convertOldXmlinitialtextAttribute(text){
    // Used to fix a bug with Cas imported from Moodle 1.9 to Moodle 2.x.
    // This could be removed in future.
    var val = 'value=';

    var xitpos = text.indexOf('xmlinitialtext');
    var valpos = text.indexOf(val, xitpos);
    var quote = text.charAt(valpos + val.length);
    var startquote = valpos + val.length + 1;
    var endquote = text.indexOf(quote, startquote);

    var value = text.substring(startquote, endquote);

    var newvalue = value.split('«').join('§lt;');
    newvalue = newvalue.split('»').join('§gt;');
    newvalue = newvalue.split('&').join('§');
    newvalue = newvalue.split('¨').join('§quot;');

    text = text.split(value).join(newvalue);
    return text;
}

/**
 * Cross-browser solution for creating new elements.
 *
 * It fixes some browser bugs.
 *
 * @param {string} elementName The tag name of the wished element.
 * @param {object} attributes An object where each key is a wished attribute name and each value is its value.
 * @param {object} creator Optional param. If supplied, this function will use the "createElement" method from this param. Else, "document" will be used.
 * @return {object} The DOM element with the specified attributes assignated.
 * @ignore
 */
function wrs_createElement(elementName, attributes, creator) {
    if (attributes === undefined) {
        attributes = {};
    }

    if (creator === undefined) {
        creator = document;
    }

    var element;

    /*
     * Internet Explorer fix:
     * If you create a new object dynamically, you can't set a non-standard attribute.
     * For example, you can't set the "src" attribute on an "applet" object.
     * Other browsers will throw an exception and will run the standard code.
     */

    try {
        var html = '<' + elementName;

        for (var attributeName in attributes) {
            html += ' ' + attributeName + '="' + wrs_htmlentities(attributes[attributeName]) + '"';
        }

        html += '>';
        element = creator.createElement(html);
    }
    catch (e) {
        element = creator.createElement(elementName);

        for (var attributeName in attributes) {
            element.setAttribute(attributeName, attributes[attributeName]);
        }
    }

    return element;
}

/**
 * Cross-browser httpRequest creation.
 * @return {object} httpRequest request object.
 * @ignore
 */
function wrs_createHttpRequest() {
    if (_wrs_currentPath.substr(0, 7) == 'file://') {
        throw 'Cross site scripting is only allowed for HTTP.';
    }

    if (typeof XMLHttpRequest != 'undefined') {
        return new XMLHttpRequest();
    }

    try {
        return new ActiveXObject('Msxml2.XMLHTTP');
    }
    catch (e) {
        try {
            return new ActiveXObject('Microsoft.XMLHTTP');
        }
        catch (oc) {
        }
    }

    return false;
}

/**
 * Gets CAS image src with AJAX.
 * @param {string} image Base 64 image stream
 * @return {string} CAS image src.
 * @ignore
 */
function wrs_createImageCASSrc(image, appletCode) {
    var data = {
        'image': image,
        'mml': appletCode
    };

    return wrs_getContent(_wrs_conf_createcasimagePath, data);
}

/**
 * Gets formula image src with AJAX.
 * @param {mathml} Mathml code.
 * @param {object} data wiris properties object.
 * @return string Image src.
 * @ignore
 */
function wrs_createImageSrc(mathml, data) {
    // Full base64 method (edit & save).
    if (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'default') {
        data['base64'] = true;
    }

    var result = wrs_getContent(_wrs_conf_createimagePath, data);

    if (result.indexOf('@BASE@') != -1) {
        // Replacing '@BASE@' with the base URL of createimage.
        var baseParts = _wrs_conf_createimagePath.split('/');
        baseParts.pop();
        result = result.split('@BASE@').join(baseParts.join('/'));
    }

    return result;
}

function wrs_createShowImageSrc(mathml, data, language) {
    var dataMd5 = []
    var renderParams = 'mml,color,centerbaseline,zoom,dpi,fontSize,fontFamily,defaultStretchy,backgroundColor,format';
    var renderParamsArray = renderParams.split(',');
    for (var key in renderParamsArray) {
        var param = renderParamsArray[key];
        if (typeof data[param] != 'undefined') {
            dataMd5[param] = data[param];
        }
    }
    // Data variables to get.
    var dataObject = {};
    for (var key in data) {
        // We don't need mathml in this request we try to get cached so we only need the formula md5 calculated before.
        if (key != 'mml') {
            dataObject[key] = data[key];
        }
    }
    dataObject.formula = com.wiris.js.JsPluginTools.md5encode(wrs_propertiesToString(dataMd5));
    dataObject.lang = (typeof language == 'undefined') ? 'en' : language;
    dataObject.version = _wrs_conf_version;

    var result = wrs_getContent(_wrs_conf_showimagePath + '?' + wrs_httpBuildQuery(dataObject));
    return result;
}

/**
 * Creates new object using its html code.
 * @param {string} objectCode html code
 * @return {object} html object.
 * @ignore
 */
function wrs_createObject(objectCode, creator) {
    if (creator === undefined) {
        creator = document;
    }

    // Internet Explorer can't include "param" tag when is setting an innerHTML property.
    objectCode = objectCode.split('<applet ').join('<span wirisObject="WirisApplet" ').split('<APPLET ').join('<span wirisObject="WirisApplet" ');  // It is a 'span' because 'span' objects can contain 'br' nodes.
    objectCode = objectCode.split('</applet>').join('</span>').split('</APPLET>').join('</span>');

    objectCode = objectCode.split('<param ').join('<br wirisObject="WirisParam" ').split('<PARAM ').join('<br wirisObject="WirisParam" ');          // It is a 'br' because 'br' can't contain nodes.
    objectCode = objectCode.split('</param>').join('</br>').split('</PARAM>').join('</br>');

    var container = wrs_createElement('div', {}, creator);
    container.innerHTML = objectCode;

    function recursiveParamsFix(object) {
        if (object.getAttribute && object.getAttribute('wirisObject') == 'WirisParam') {
            var attributesParsed = {};

            for (var i = 0; i < object.attributes.length; ++i) {
                if (object.attributes[i].nodeValue !== null) {
                    attributesParsed[object.attributes[i].nodeName] = object.attributes[i].nodeValue;
                }
            }

            var param = wrs_createElement('param', attributesParsed, creator);

            // IE fix.
            if (param.NAME) {
                param.name = param.NAME;
                param.value = param.VALUE;
            }

            param.removeAttribute('wirisObject');
            object.parentNode.replaceChild(param, object);
        }
        else if (object.getAttribute && object.getAttribute('wirisObject') == 'WirisApplet') {
            var attributesParsed = {};

            for (var i = 0; i < object.attributes.length; ++i) {
                if (object.attributes[i].nodeValue !== null) {
                    attributesParsed[object.attributes[i].nodeName] = object.attributes[i].nodeValue;
                }
            }

            var applet = wrs_createElement('applet', attributesParsed, creator);
            applet.removeAttribute('wirisObject');

            for (var i = 0; i < object.childNodes.length; ++i) {
                recursiveParamsFix(object.childNodes[i]);

                if (object.childNodes[i].nodeName.toLowerCase() == 'param') {
                    applet.appendChild(object.childNodes[i]);
                    --i;    // When we insert the object child into the applet, object loses one child.
                }
            }

            object.parentNode.replaceChild(applet, object);
        }
        else {
            for (var i = 0; i < object.childNodes.length; ++i) {
                recursiveParamsFix(object.childNodes[i]);
            }
        }
    }

    recursiveParamsFix(container);
    return container.firstChild;
}

/**
 * Converts an object to its HTML code.
 * @param {object} object DOM object..
 * @return {string} HTML code.
 * @ignore
 */
function wrs_createObjectCode(object) {
    if (object.nodeType == 1) { // ELEMENT_NODE.
        var output = '<' + object.tagName;

        for (var i = 0; i < object.attributes.length; ++i) {
            if (object.attributes[i].specified) {
                output += ' ' + object.attributes[i].name + '="' + wrs_htmlentities(object.attributes[i].value) + '"';
            }
        }

        if (object.childNodes.length > 0) {
            output += '>';

            for (var i = 0; i < object.childNodes.length; ++i) {
                output += wrs_createObjectCode(object.childNodes[i]);
            }

            output += '</' + object.tagName + '>';
        }
        else if (object.nodeName == 'DIV' || object.nodeName == 'SCRIPT') {
            output += '></' + object.tagName + '>';
        }
        else {
            output += '/>';
        }

        return output;
    }

    if (object.nodeType == 3) { // TEXT_NODE.
        return wrs_htmlentities(object.nodeValue);
    }

    return '';
}

/**
 * Parses end HTML code. The end HTML code is HTML code with embedded images or LaTeX formulas created with the WIRIS editor. <br>
 * By default this method converts the formula images and LaTeX strings in MathML. <br>
 * If image mode is enabled the images will not be converted into MathML. For further information see {@link http://www.wiris.com/plugins/docs/full-mathml-mode}.
 * @param {string} code String to be parsed.
 * @param {object} wirisProperties Extra attributes for the formula.
 * @param {string} language Language for the formula.
 * @return {string}
 */
function wrs_endParse(code, wirisProperties, language) {
    code = wrs_endParseEditMode(code, wirisProperties, language);
    return wrs_endParseSaveMode(code);
}

function wrs_regexpIndexOf(input, regexp, start) {
    var index = input.substring(start || 0).search(regexp);
    return (index >= 0) ? (index + (start || 0)) : index;
}

/**
 * Parses end HTML code depending on the edit mode.
 * @param {string} code HTML code to be parsed.
 * @param {object} wirisProperties Extra formula attributes.
 * @param {string} language Language for the formula.
 * @return {string}
 * @ignore
 */
function wrs_endParseEditMode(code, wirisProperties, language) {
    // Converting LaTeX to images.

    if (window._wrs_conf_parseModes !== undefined && wrs_arrayContains(_wrs_conf_parseModes, 'latex') != -1) {
        var output = '';
        var endPosition = 0;
        var startPosition = code.indexOf('$$');

        while (startPosition != -1) {
            output += code.substring(endPosition, startPosition);
            endPosition = code.indexOf('$$', startPosition + 2);

            if (endPosition != -1) {
                var latex = code.substring(startPosition + 2, endPosition);

                if (latex.indexOf('<') == -1) {
                    latex = wrs_htmlentitiesDecode(latex);
                    var mathml = wrs_getMathMLFromLatex(latex, true);
                    output += mathml;
                    endPosition += 2;
                }
                else {
                    output += '$$';
                    endPosition = startPosition + 2;
                }
            }
            else {
                output += '$$';
                endPosition = startPosition + 2;
            }

            startPosition = code.indexOf('$$', endPosition);
        }

        output += code.substring(endPosition, code.length);
        code = output;
    }

    if (window._wrs_conf_defaultEditMode && _wrs_conf_defaultEditMode == 'iframes') {
        // Converting iframes to images.
        var output = '';
        var pattern = ' class="' + _wrs_conf_imageClassName + '"';
        var formulaPosition = code.indexOf(pattern);
        var endPosition = 0;

        while (formulaPosition != -1) {
            // Looking for the actual startPosition.
            startPosition = formulaPosition;
            var i = formulaPosition;
            var startTagFound = false;

            while (i >= 0 && !startTagFound) {      // Going backwards until the start tag '<' is found.
                var character = code.charAt(i);

                if (character == '"' || character == '\'') {
                    var characterNextPosition = code.lastIndexOf(character, i);
                    i = (characterNextPosition == -1) ? -1 : characterNextPosition;
                }
                else if (character == '<') {
                    startPosition = i;
                    startTagFound = true;
                }
                else if (character == '>') {
                    i = -1;                 // Break: we are inside a text node.
                }

                --i;
            }

            // Appending the previous code.
            output += code.substring(endPosition, startPosition);

            // Looking for the endPosition.

            if (startTagFound) {
                i = formulaPosition;
                var counter = 1;

                while (i < code.length && counter > 0) {
                    var character = code.charAt(i);

                    if (character == '"' || character == '\'') {
                        var characterNextPosition = code.indexOf(character, i);
                        i = (characterNextPosition == -1) ? code.length : characterNextPosition;
                    }
                    else if (character == '<') {
                        if (i + 1 < code.length && code.charAt(i + 1) == '/') {
                            --counter;

                            if (counter == 0) {
                                endPosition = code.indexOf('>', i) + 1;

                                if (endPosition == -1) {
                                    // End tag stripped.
                                    counter = -1;       // to be != 0 and to break the loop.
                                }
                            }
                        }
                        else {
                            ++counter;
                        }
                    }
                    else if (character == '>' && code.charAt(i - 1) == '/') {
                        --counter;

                        if (counter == 0) {
                            endPosition = i + 1;
                        }
                    }

                    ++i;
                }

                if (counter == 0) {
                    var formulaTagCode = code.substring(startPosition, endPosition);
                    var formulaTagObject = wrs_createObject(formulaTagCode);
                    var mathml = formulaTagObject.getAttribute(_wrs_conf_imageMathmlAttribute);

                    if (mathml == null) {
                        mathml = formulaTagObject.getAttribute('alt');
                    }

                    var imgObject = wrs_mathmlToImgObject(document, mathml, wirisProperties, language);
                    output += wrs_createObjectCode(imgObject);
                }
                else {
                    // Start tag found but no end tag found. No process is done. A character is appended to avoid infinite loop in the next search.
                    output += code.charAt(formulaPosition);
                    endPosition = formulaPosition + 1;
                }
            }
            else {
                // No start tag is found. No process is done. A character is appended to avoid infinite loop in the next search.
                output += code.charAt(formulaPosition);
                endPosition = formulaPosition + 1;
            }

            formulaPosition = code.indexOf(pattern, endPosition);
        }

        output += code.substring(endPosition, code.length);
        code = output;
    }

    return code;
}

/**
 * Parses end HTML code depending on the save mode.
 * @param {string} code HTML code
 * @return {string}
 * @ignore
 */
function wrs_endParseSaveMode(code) {
    var output = '';
    var convertToXml = false;
    var convertToSafeXml = false;

    if (window._wrs_conf_saveMode) {
        if (_wrs_conf_saveMode == 'safeXml') {
            convertToXml = true;
            convertToSafeXml = true;
        }
        else if (_wrs_conf_saveMode == 'xml') {
            convertToXml = true;
        }
    }

    if (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'image') {
        code = wrs_codeImgTransform(code, 'img264');
    } else if (convertToXml || convertToSafeXml) {
        code = wrs_codeImgTransform(code, 'img2mathml');
    }

    return code;
}

/**
 * Gets the formula mathml or CAS appletCode using its image hash code.
 * @param {string} variableName Variable to send on POST query to the server.
 * @param {string} imageHashCode image hash code.
 * @return {string} Corresponding mathml code.
 * @ignore
 */
function wrs_getCode(variableName, imageHashCode) {
    var data = {};
    data[variableName] = imageHashCode;
    return wrs_getContent(_wrs_conf_getmathmlPath, data);
}

/**
 * Gets the content from an URL.
 * @param {string} url target URL.
 * @param {object} postVariables post variables. Null if a GET query should be done.
 * @return {string} content of the target URL.
 * @ignore
 */
function wrs_getContent(url, postVariables) {
    try {
        var httpRequest = wrs_createHttpRequest();

        if (httpRequest) {
            if (typeof postVariables === undefined || typeof postVariables == 'undefined') {
                httpRequest.open('GET', url, false);
            }
            else if (url.substr(0, 1) == '/' || url.substr(0, 7) == 'http://' || url.substr(0, 8) == 'https://') {
                httpRequest.open('POST', url, false);
            }
            else {
                httpRequest.open('POST', _wrs_currentPath + url, false);
            }

            if (postVariables !== undefined) {
                httpRequest.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=UTF-8');
                httpRequest.send(wrs_httpBuildQuery(postVariables));
            }
            else {
                httpRequest.send(null);
            }

            return httpRequest.responseText;
        }

        alert('Your browser is not compatible with AJAX technology. Please, use the latest version of Mozilla Firefox.');
    }
    catch (e) {
    }

    return '';
}

/**
 * Generates the innerHTML of an element.
 * @param {object} element target element.
 * @return {string} innertHTML of the target element.
 * @ignore
 */
function wrs_getInnerHTML(element) {
    var innerHTML = '';

    for (var i = 0; i < element.childNodes.length; ++i) {
        innerHTML += wrs_createObjectCode(element.childNodes[i]);
    }

    return innerHTML;
}

/**
 * Converts MathML to LaTeX.
 * @param {string} mathml MathML String
 * @return {string} MathML corresponding LaTeX.
 * @ignore
 */
function wrs_getLatexFromMathML(mathml) {
    var data = {
        'service': 'mathml2latex',
        'mml': mathml
    };

    return wrs_getContent(_wrs_conf_servicePath, data);
}

/**
 * Extracts the latex of a determined position in a text.
 * @param {string} textNode test to extract LaTeX
 * @param {int} caretPosition starting position to find LaTeX.
 * @return {object} An object with 3 keys: 'latex', 'start' and 'end'. Null if latex is not found.
 * @ignore
 */
function wrs_getLatexFromTextNode(textNode, caretPosition) {
    // Looking for the first textNode.
    var startNode = textNode;

    while (startNode.previousSibling && startNode.previousSibling.nodeType == 3) { // TEXT_NODE.
        startNode = startNode.previousSibling;
    }

    // Finding latex.

    function getNextLatexPosition(currentNode, currentPosition) {
        var position = currentNode.nodeValue.indexOf('$$', currentPosition);

        while (position == -1) {
            currentNode = currentNode.nextSibling;

            if (!currentNode || currentNode.nodeType != 3) { // TEXT_NODE.
                return null; // Not found.
            }

            position = currentNode.nodeValue.indexOf('$$');
        }

        return {
            'node': currentNode,
            'position': position
        };
    }

    function isPrevious(node, position, endNode, endPosition) {
        if (node == endNode) {
            return (position <= endPosition);
        }

        while (node && node != endNode) {
            node = node.nextSibling;
        }

        return (node == endNode);
    }

    var start;

    var end = {
        'node': startNode,
        'position': 0
    };

    do {
        var start = getNextLatexPosition(end.node, end.position);

        if (start == null || isPrevious(textNode, caretPosition, start.node, start.position)) {
            return null;
        }

        var end = getNextLatexPosition(start.node, start.position + 2);

        if (end == null) {
            return null;
        }

        end.position += 2;
    } while (isPrevious(end.node, end.position, textNode, caretPosition));

    // Isolating latex.
    var latex;

    if (start.node == end.node) {
        latex = start.node.nodeValue.substring(start.position + 2, end.position - 2);
    }
    else {
        latex = start.node.nodeValue.substring(start.position + 2, start.node.nodeValue.length);
        var currentNode = start.node;

        do {
            currentNode = currentNode.nextSibling;

            if (currentNode == end.node) {
                latex += end.node.nodeValue.substring(0, end.position - 2);
            }
            else {
                latex += currentNode.nodeValue;
            }
        } while (currentNode != end.node);
    }

    return {
        'latex': latex,
        'startNode': start.node,
        'startPosition': start.position,
        'endNode': end.node,
        'endPosition': end.position
    };
}

/**
 * Converts LaTeX to MathML.
 * @param {string} latex String
 * @param {bool} includeLatexOnSemantics If true LaTeX would me included into MathML semantics.
 * @return {string} converted mathML
 * @ignore
 */
function wrs_getMathMLFromLatex(latex, includeLatexOnSemantics) {
    if (_wrs_int_LatexCache.hasOwnProperty(latex)) {
        return _wrs_int_LatexCache[latex];
    }
    var data = {
        'service': 'latex2mathml',
        'latex': latex
    };

    if (includeLatexOnSemantics) {
        data['saveLatex'] = '';
    }

    var mathML = wrs_getContent(_wrs_conf_servicePath, data);
    // Populate LatexCache.
    wrs_populateLatexCache(latex, mathML);
    return mathML.split("\r").join('').split("\n").join(' ');
}

/**
 * Gets the node length in characters.
 * @param {object} node HTML node.
 * @return {int} node length
 * @ignore
 */
function wrs_getNodeLength(node) {
    if (node.nodeType == 3) { // TEXT_NODE.
        return node.nodeValue.length;
    }

    if (node.nodeType == 1) { // ELEMENT_NODE.
        var length = _wrs_staticNodeLengths[node.nodeName.toUpperCase()];

        if (length === undefined) {
            length = 0;
        }

        for (var i = 0; i < node.childNodes.length; ++i) {
            length += wrs_getNodeLength(node.childNodes[i]);
        }

        return length;
    }

    return 0;
}

/**
 * Parses the query string and returns it as a Hash table.
 * @param {object} windowObject a window object with a query string.
 * @return {object} a hash table containing the query string.
 * @ignore
 */
function wrs_getQueryParams(windowObject) {
    var data = {};
    var start = windowObject.location.search.indexOf('?');
    start = (start == -1) ? 0 : start + 1;
    var queryStringParts = windowObject.location.search.substr(start).split('&');

    for (var i = 0; i < queryStringParts.length; ++i) {
        var paramParts = queryStringParts[i].split('=', 2);
        data[paramParts[0]] = wrs_urldecode(paramParts[1]);
    }

    return data;
}

/**
 * Gets the selected node or text.
 * If the caret is on a text node, concatenates it with all the previous and next text nodes.
 * @param {object} target The editable element
 * @param {boolean} isIframe Specifies if the target is an iframe or not
 * @param {forceGetSelection} If true, ignores IE system to get the current selection and uses window.getSelection()
 * @return {object} An object with the 'node' key setted if the item is an element or the keys 'node' and 'caretPosition' if the element is text
 * @ignore
 */
function wrs_getSelectedItem(target, isIframe, forceGetSelection) {
    var windowTarget;

    if (isIframe) {
        windowTarget = target.contentWindow;
        windowTarget.focus();
    }
    else {
        windowTarget = window;
        target.focus();
    }

    if (document.selection && !forceGetSelection) {
        var range = windowTarget.document.selection.createRange();

        if (range.parentElement) {
            if (range.htmlText.length > 0) {
                if (range.text.length == 0) {
                    return wrs_getSelectedItem(target, isIframe, true);
                }

                return null;
            }

            windowTarget.document.execCommand('InsertImage', false, '#');
            var temporalObject = range.parentElement();

            if (temporalObject.nodeName.toUpperCase() != 'IMG') {
                // IE9 fix: parentElement() does not return the IMG node, returns the parent DIV node. In IE < 9, pasteHTML does not work well.
                range.pasteHTML('<span id="wrs_openEditorWindow_temporalObject"></span>');
                temporalObject = windowTarget.document.getElementById('wrs_openEditorWindow_temporalObject');
            }

            var node;
            var caretPosition;

            if (temporalObject.nextSibling && temporalObject.nextSibling.nodeType == 3) { // TEXT_NODE.
                node = temporalObject.nextSibling;
                caretPosition = 0;
            }
            else if (temporalObject.previousSibling && temporalObject.previousSibling.nodeType == 3) { // TEXT_NODE.
                node = temporalObject.previousSibling;
                caretPosition = node.nodeValue.length;
            }
            else {
                node = windowTarget.document.createTextNode('');
                temporalObject.parentNode.insertBefore(node, temporalObject);
                caretPosition = 0;
            }

            temporalObject.parentNode.removeChild(temporalObject);

            return {
                'node': node,
                'caretPosition': caretPosition
            };
        }

        if (range.length > 1) {
            return null;
        }

        return {
            'node': range.item(0)
        };
    }

    if (windowTarget.getSelection) {
        var selection = windowTarget.getSelection();

        try {
            var range = selection.getRangeAt(0);
        }
        catch (e) {
            var range = windowTarget.document.createRange();
        }

        var node = range.startContainer;

        if (node.nodeType == 3) { // TEXT_NODE.
            if (range.startOffset != range.endOffset) {
                return null;
            }

            return {
                'node': node,
                'caretPosition': range.startOffset
            };
        }

        if (node != range.endContainer) {
            return null;
        }

        if (node.nodeType == 1) { // ELEMENT_NODE.
            var position = range.startOffset;

            if (node.childNodes[position]) {
                return {
                    'node': node.childNodes[position]
                };
            }
        }
    }

    return null;
}

/**
 * Converts the HTML of a image into the output code that WIRIS must return.
 * By default returns the mathml stored on data-mahml attribute (if imgCode is a formula)
 * or the Wiriscas attribute of a WIRIS applet.
 * @param {string} imgCode the html code from a formula or a CAS image.
 * @param {bool} convertToXml True if the image should be converted to xml.
 * @param {bool} convertToSafeXml True if the image should be conerte to safeXmll
 * @return {string} the Xml or safeXml of a WIRIS image.
 * @ignore
 */
function wrs_getWIRISImageOutput(imgCode, convertToXml, convertToSafeXml) {
    var imgObject = wrs_createObject(imgCode);

    if (imgObject) {
        if (imgObject.className == _wrs_conf_imageClassName || imgObject.getAttribute(_wrs_conf_imageMathmlAttribute)) {
            if (!convertToXml) {
                return imgCode;
            }

            var xmlCode = imgObject.getAttribute(_wrs_conf_imageMathmlAttribute);

            if (xmlCode == null) {
                xmlCode = imgObject.getAttribute('alt');
            }

            if (!convertToSafeXml) {
                xmlCode = wrs_mathmlDecode(xmlCode);
            }

            return xmlCode;
        }
        else if (imgObject.className == _wrs_conf_CASClassName) {
            var appletCode = imgObject.getAttribute(_wrs_conf_CASMathmlAttribute);
            appletCode = wrs_mathmlDecode(appletCode);
            var appletObject = wrs_createObject(appletCode);
            appletObject.setAttribute('src', imgObject.src);
            var object = appletObject;
            var appletCodeToBeInserted = wrs_createObjectCode(appletObject);

            if (convertToSafeXml) {
                appletCodeToBeInserted = wrs_mathmlEncode(appletCodeToBeInserted);
            }

            return appletCodeToBeInserted;
        }
    }

    return imgCode;
}

/**
 * Parses a text and replaces all HTML special characters by their entities.
 * @param {string} input Text to be paresed.
 * @return {string} the input text with all their special characters replaced by their entities.
 * @ignore
 */
function wrs_htmlentities(input) {
    return input.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

/**
 * Parses a text and replaces all the HTML entities by their characters.
 * @param {string} input Text to be parsed
 * @return {string} The input text with all their entities replaced by characters.
 * @ignore
 */
function wrs_htmlentitiesDecode(input) {
    return input.split('&quot;').join('"').split('&gt;').join('>').split('&lt;').join('<').split('&amp;').join('&');
}

/**
 * Converts a hash to a HTTP query.
 * @param {hash} properties A key-value Hash
 * @return {string} A HTTP query containing all the key value pairs with all the shpecial characters replaced by their entities.
 * @ignore
 */
function wrs_httpBuildQuery(properties) {
    var result = '';

    for (i in properties) {
        if (properties[i] != null) {
            result += wrs_urlencode(i) + '=' + wrs_urlencode(properties[i]) + '&';
        }
    }

    // Deleting last '&' empty character.
    if (result.substring(result.length - 1) == '&') {
        result = result.substring(0, result.length - 1);
    }

    return result;
}

/**
 * Parses initial HTML code. If the HTML contains data generated by WIRIS, this data would be converted as following:
 * <pre>
 * MathML code: Image containing the corresponding MathML formulas.
 * MathML code with LaTeX annotation : LaTeX.
 * </pre>
 * @param {string} code HTML code with data generated by WIRIS plugin.
 * @param {string} language Language for the formula.
 * @return {string} HTML code with the WIRIS data converted into LaTeX and images.
 */
 /* Note: The code inside this function has been inverted.
    If you invert again the code then you cannot use correctly LaTeX
    in Moodle.
 */
function wrs_initParse(code, language) {
    wrs_initSetSize();
    if (window._wrs_conf_saveMode) {
        _wrs_parseXml = _wrs_conf_saveMode == 'safeXml'|| _wrs_conf_saveMode == 'xml';
        if (window._wrs_conf_parseModes !== undefined) {
            _wrs_parseXml = _wrs_parseXml || wrs_arrayContains(_wrs_conf_parseModes, 'xml') != -1;
        }
    }
    code = wrs_initParseSaveMode(code, language);
    return wrs_initParseEditMode(code);
}

/**
 * Parses initial HTML code into iframes.
 * @param  {object} windowTarget Target object window.
 * @ignore
 */
function wrs_initParseImgToIframes(windowTarget) {
    if (window._wrs_conf_defaultEditMode && _wrs_conf_defaultEditMode == 'iframes') {
        var imgList = windowTarget.document.getElementsByTagName('img');
        var i = 0;

        while (i < imgList.length) {
            if (imgList[i].className == _wrs_conf_imageClassName) {
                var mathml = imgList[i].getAttribute(_wrs_conf_imageMathmlAttribute);

                if (mathml == null) {
                    mathml = imgList[i].getAttribute('alt');
                }

                var iframe = wrs_mathmlToIframeObject(windowTarget, wrs_mathmlDecode(mathml));
                imgList[i].parentNode.replaceChild(iframe, imgList[i]);
            }
            else {
                ++i;
            }
        }
    }
}

/**
 * Parses initial HTML code depending on the edit mode.
 * @param {string} code HTML code.
 * @return {string} parsed HTML code.
 * @ignore
 */
function wrs_initParseEditMode(code) {
    if (window._wrs_conf_parseModes !== undefined && wrs_arrayContains(_wrs_conf_parseModes, 'latex') != -1) {
        var imgList = wrs_getElementsByNameFromString(code, 'img', true);
        var token = 'encoding="LaTeX">';
        var carry = 0;          // While replacing images with latex, the indexes of the found images changes respecting the original code, so this carry is needed.

        for (var i = 0; i < imgList.length; ++i) {
            var imgCode = code.substring(imgList[i].start + carry, imgList[i].end + carry);

            if (imgCode.indexOf(' class="' + _wrs_conf_imageClassName + '"') != -1) {
                var mathmlStartToken = ' ' + _wrs_conf_imageMathmlAttribute + '="';
                var mathmlStart = imgCode.indexOf(mathmlStartToken);

                if (mathmlStart == -1) {
                    mathmlStartToken = ' alt="';
                    mathmlStart = imgCode.indexOf(mathmlStartToken);
                }

                if (mathmlStart != -1) {
                    mathmlStart += mathmlStartToken.length;
                    var mathmlEnd = imgCode.indexOf('"', mathmlStart);
                    var mathml = wrs_mathmlDecode(imgCode.substring(mathmlStart, mathmlEnd));
                    var latexStartPosition = mathml.indexOf(token);

                    if (latexStartPosition != -1) {
                        latexStartPosition += token.length;
                        var latexEndPosition = mathml.indexOf('</annotation>', latexStartPosition);
                        var latex = mathml.substring(latexStartPosition, latexEndPosition);

                        var replaceText = '$$' + wrs_htmlentitiesDecode(latex) + '$$';
                        code = code.substring(0, imgList[i].start + carry) + replaceText + code.substring(imgList[i].end + carry);
                        carry += replaceText.length - (imgList[i].end - imgList[i].start);
                    }
                }
            }
        }
    }

    return code;
}

/**
 * Parses initial HTML code depending on the save mode.
 * @param {string} code HTML code to be parsed
 * @param {string} language Language for the formula.
 * @return {string} HTML code parsed.
 * @ignore
 */
function wrs_initParseSaveMode(code, language) {
    if (window._wrs_conf_saveMode) {

        if (_wrs_parseXml) {
            // Converting XML to tags.
            code = wrs_parseMathmlToLatex(code, _wrs_safeXmlCharacters);
            code = wrs_parseMathmlToLatex(code, _wrs_xmlCharacters);
            // Safe XML and XML must be parsed regardeless of save mode.
            // Order is important here, safeXml must be parsed first in order to avoid conflicts with data-mathml img attribute.
            code = wrs_parseSafeAppletsToObjects(code);
            code = wrs_parseMathmlToImg(code, _wrs_safeXmlCharacters, language);
            code = wrs_parseMathmlToImg(code, _wrs_xmlCharacters, language);
        }

        if (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'image') {
            code = wrs_codeImgTransform(code, 'base642showimage');
        }
    }

    var appletList = wrs_getElementsByNameFromString(code, 'applet', false);
    var carry = 0;          // While replacing applets with images, the indexes of the found applets changes respecting the original code, so this carry is needed.

    for (var i = 0; i < appletList.length; ++i) {
        var appletCode = code.substring(appletList[i].start + carry, appletList[i].end + carry);

        // The second control in the if is used to find WIRIS applet which don't have Wiriscas class (as it was in old CAS applets).
        if (appletCode.indexOf(' class="' + _wrs_conf_CASClassName + '"') != -1 || appletCode.toUpperCase().indexOf('WIRIS') != -1) {
            if (appletCode.indexOf(' src="') != -1){
                var srcStart = appletCode.indexOf(' src="') + ' src="'.length;
                var srcEnd = appletCode.indexOf('"', srcStart);
                var src = appletCode.substring(srcStart, srcEnd);
            } else{
                // This should happen only with old CAS imported from Moodle 1 to Moodle 2.
                if (typeof(_wrs_conf_pluginBasePath) != 'undefined'){
                    var src = _wrs_conf_pluginBasePath + '/integration/showcasimage.php?formula=noimage';
                } else {
                    var src = '';
                }
                if (appletCode.indexOf(' class="' + _wrs_conf_CASClassName + '"') == -1){
                    var closeSymbol = appletCode.indexOf('>');
                    var appletTag = appletCode.substring(0, closeSymbol);
                    var newAppletTag = appletTag.split(' width=').join(' class="Wiriscas" width=');
                    appletCode = appletCode.split(appletTag).join(newAppletTag);
                    appletCode = appletCode.split('\'').join('"');
                }
            }

            // Double click to edit has been removed here.
            var imgCode = '<img align="middle" class="' + _wrs_conf_CASClassName + '" ' + _wrs_conf_CASMathmlAttribute + '="' + wrs_mathmlEncode(appletCode) + '" src="' + src + '" />';

            code = code.substring(0, appletList[i].start + carry) + imgCode + code.substring(appletList[i].end + carry);
            carry += imgCode.length - (appletList[i].end - appletList[i].start);
        }
    }

    return code;
}

/**
 * Looks for elements that match the given name in a HTML code string.
 * Important: this function is very concrete for WIRIS code. It takes as preconditions lots of behaviors that are not the general case.
 *
 * @param {string} code HTML code
 * @param {string} name Element names
 * @param {boolean} autoClosed True if the elements are autoClosed.
 * @return {array} An array containing all HTML elements of code matching the name argument.
 * @ignore
 */
function wrs_getElementsByNameFromString(code, name, autoClosed) {
    var elements = [];
    var code = code.toLowerCase();
    name = name.toLowerCase();
    var start = code.indexOf('<' + name + ' ');

    while (start != -1) {                       // Look for nodes.
        var endString;

        if (autoClosed) {
            endString = '>';
        }
        else {
            endString = '</' + name + '>';
        }

        var end = code.indexOf(endString, start);

        if (end != -1) {
            end += endString.length;

            elements.push({
                'start': start,
                'end': end
            });
        }
        else {
            end = start + 1;
        }

        start = code.indexOf('<' + name + ' ', end);
    }

    return elements;
}

/**
 * Replaces a selection with an element.
 * @param {object} element Element
 * @param {object} focusElement Element to be focused
 * @param {object} windowTarget Target
 * @ignore
 */
function wrs_insertElementOnSelection(element, focusElement, windowTarget) {
    try {
        focusElement.focus();

        // Integration function
        // If wrs_int_insertElementOnSelection function exists on
        // integration script can call focus method from the editor instance.
        // For example, on CKEditor calls CKEditorInstance.focus() method.
        // With this method we can call proper focus methods which in some scenarios
        // help's WIRIS plugin to focus properly on the current editor window.
        if (typeof wrs_int_insertElementOnSelection != 'undefined') {
            wrs_int_insertElementOnSelection();
        }

        if (_wrs_isNewElement) {
            if (document.selection && document.getSelection == 0) {
                var range = windowTarget.document.selection.createRange();
                windowTarget.document.execCommand('InsertImage', false, element.src);

                if (!('parentElement' in range)) {
                    windowTarget.document.execCommand('delete', false);
                    range = windowTarget.document.selection.createRange();
                    windowTarget.document.execCommand('InsertImage', false, element.src);
                }

                if ('parentElement' in range) {
                    var temporalObject = range.parentElement();

                    if (temporalObject.nodeName.toUpperCase() == 'IMG') {
                        temporalObject.parentNode.replaceChild(element, temporalObject);
                    }
                    else {
                        // IE9 fix: parentNode() does not return the IMG node, returns the parent DIV node. In IE < 9, pasteHTML does not work well.
                        range.pasteHTML(wrs_createObjectCode(element));
                    }
                }
            }
            else {
                var ua = navigator.userAgent.toLowerCase();
                var isAndroid = ua.indexOf("android") > -1;
                var isIOS = ((ua.indexOf("ipad") > -1) || (ua.indexOf("iphone") > -1));
                var selection = windowTarget.getSelection();
                if (_wrs_range) {
                    var range = _wrs_range;
                    _wrs_range = null;
                }
                else {

                    try {
                        var range = selection.getRangeAt(0);
                    }
                    catch (e) {
                        var range = windowTarget.document.createRange();
                    }
                }
                selection.removeAllRanges();

                range.deleteContents();

                var node = range.startContainer;
                var position = range.startOffset;

                if (node.nodeType == 3) { // TEXT_NODE.
                    node = node.splitText(position);
                    node.parentNode.insertBefore(element, node);
                    node = node.parentNode;
                }
                else if (node.nodeType == 1) { // ELEMENT_NODE.
                    node.insertBefore(element, node.childNodes[position]);
                }

                if (!isAndroid && !isIOS){
                    // Fix to set the caret after the inserted image.
                    range.selectNode(element);
                    position = range.endOffset;
                    selection.collapse(node, position);
                }
            }
        }
        else if (_wrs_temporalRange) {
            if (document.selection && document.getSelection == 0) {
                _wrs_isNewElement = true;
                _wrs_temporalRange.select();
                wrs_insertElementOnSelection(element, focusElement, windowTarget);
            }
            else {
                var parentNode = _wrs_temporalRange.startContainer;
                _wrs_temporalRange.deleteContents();
                _wrs_temporalRange.insertNode(element);
            }
        }
        else {
            if (!element) { // Editor empty, formula has been erased on edit.
                _wrs_temporalImage.parentNode.removeChild(_wrs_temporalImage);
            }
            _wrs_temporalImage.parentNode.replaceChild(element, _wrs_temporalImage);
        }
    }
    catch (e) {
    }
}

/**
 * Checks if the mathml at position i is inside an HTML attribute or not.
 * @param {string} content A string containing MathML code.
 * @param {string} i Search index.
 * @return {bool} True if is inside an HTML attribute. In other case, false.
 * @ignore
 */
function wrs_isMathmlInAttribute(content, i) {
    // Regex = '^[\'"][\\s]*=[\\s]*[\\w-]+([\\s]*("[^"]*"|\'[^\']*\')[\\s]*=[\\s]*[\\w-]+[\\s]*)*[\\s]+gmi<';
    var math_att = '[\'"][\\s]*=[\\s]*[\\w-]+';                         // "=att OR '=att
    var att_content = '"[^"]*"|\'[^\']*\'';                             // "blabla" OR 'blabla'
    var att = '[\\s]*(' + att_content + ')[\\s]*=[\\s]*[\\w-]+[\\s]*';  // "blabla"=att OR 'blabla'=att
    var atts = '(' + att + ')*';                                        // "blabla"=att1 "blabla"=att2
    var regex = '^' + math_att + atts + '[\\s]+gmi<';                   // "=att "blabla"=att1 "blabla"=att2 gmi< .
    var expression = new RegExp(regex);

    var actual_content = content.substring(0, i);
    var reversed = actual_content.split('').reverse().join('');
    var exists = expression.test(reversed);

    return exists;
}

/**
 * WIRIS special encoding.
 * We use these entities because IE doesn't support html entities on its attributes sometimes. Yes, sometimes.
 * @param {string} input String to be decoded.
 * @return {string} Decoded string.
 * @ignore
 */
function wrs_mathmlDecode(input) {
    // Decoding entities.
    input = input.split(_wrs_safeXmlCharactersEntities.tagOpener).join(_wrs_safeXmlCharacters.tagOpener);
    input = input.split(_wrs_safeXmlCharactersEntities.tagCloser).join(_wrs_safeXmlCharacters.tagCloser);
    input = input.split(_wrs_safeXmlCharactersEntities.doubleQuote).join(_wrs_safeXmlCharacters.doubleQuote);
    // Added to fix problem due to import from 1.9.x.
    input = input.split(_wrs_safeXmlCharactersEntities.realDoubleQuote).join(_wrs_safeXmlCharacters.realDoubleQuote);

    // Blackboard.
    if ('_wrs_blackboard' in window && window._wrs_blackboard){
        input = input.split(_wrs_safeBadBlackboardCharacters.ltElement).join(_wrs_safeGoodBlackboardCharacters.ltElement);
        input = input.split(_wrs_safeBadBlackboardCharacters.gtElement).join(_wrs_safeGoodBlackboardCharacters.gtElement);
        input = input.split(_wrs_safeBadBlackboardCharacters.ampElement).join(_wrs_safeGoodBlackboardCharacters.ampElement);

        /*var regex = /«mtext».*[<>&].*«\/mtext»/;

        var result = regex.exec(input);
        while(result){
            var changedResult = result[0].split(_wrs_xmlCharacters.tagOpener).join('§lt;');
            changedResult = changedResult.split(_wrs_xmlCharacters.tagCloser).join('§gt;');
            changedResult = changedResult.split(_wrs_xmlCharacters.ampersand).join('§amp;');
            input = input.replace(result, changedResult);
            result = regex.exec(input);
        }*/
    }

    // Decoding characters.
    input = input.split(_wrs_safeXmlCharacters.tagOpener).join(_wrs_xmlCharacters.tagOpener);
    input = input.split(_wrs_safeXmlCharacters.tagCloser).join(_wrs_xmlCharacters.tagCloser);
    input = input.split(_wrs_safeXmlCharacters.doubleQuote).join(_wrs_xmlCharacters.doubleQuote);
    input = input.split(_wrs_safeXmlCharacters.ampersand).join(_wrs_xmlCharacters.ampersand);
    input = input.split(_wrs_safeXmlCharacters.quote).join(_wrs_xmlCharacters.quote);

    // We are replacing $ by & when its part of an entity for retrocompatibility. Now, the standard is replace § by &.
    var returnValue = '';
    var currentEntity = null;

    for (var i = 0; i < input.length; ++i) {
        var character = input.charAt(i);

        if (currentEntity == null) {
            if (character == '$') {
                currentEntity = '';
            }
            else {
                returnValue += character;
            }
        }
        else {
            if (character == ';') {
                returnValue += '&' + currentEntity + ';';
                currentEntity = null;
            }
            else if (character.match(/([a-zA-Z0-9#._-] | '-')/)) {  // Character is part of an entity.
                currentEntity += character;
            }
            else {
                returnValue += '$' + currentEntity; // Is not an entity.
                currentEntity = null;
                --i; // Parse again the current character.
            }
        }
    }

    return returnValue;
}

/**
 * WIRIS special encoding.
 * We use these entities because IE doesn't support html entities on its attributes sometimes. Yes, sometimes.
 * @param {string} input to be encoded
 * @return {string} Encoded string.
 * @ignore
 */
function wrs_mathmlEncode(input) {
    input = input.split(_wrs_xmlCharacters.tagOpener).join(_wrs_safeXmlCharacters.tagOpener);
    input = input.split(_wrs_xmlCharacters.tagCloser).join(_wrs_safeXmlCharacters.tagCloser);
    input = input.split(_wrs_xmlCharacters.doubleQuote).join(_wrs_safeXmlCharacters.doubleQuote);
    input = input.split(_wrs_xmlCharacters.ampersand).join(_wrs_safeXmlCharacters.ampersand);
    input = input.split(_wrs_xmlCharacters.quote).join(_wrs_safeXmlCharacters.quote);

    return input;
}

/**
 * Converts special symbols (> 128) to entities and replaces all textual entities by its number entities.
 * @param {string} mathml MathML string containing - or not - special symbols
 * @return {string} MathML with all textual entities replaced.
 * @ignore
 */
function wrs_mathmlEntities(mathml) {
    var toReturn = '';

    for (var i = 0; i < mathml.length; ++i) {
        var character = mathml.charAt(i);

        // Parsing > 128 characters.
        if (mathml.charCodeAt(i) > 128) {
            toReturn += '&#' + mathml.charCodeAt(i) + ';';
        }
        else if (character == '&') {
            var end = mathml.indexOf(';', i + 1);

            if (end >= 0) {
                var container = document.createElement('span');
                container.innerHTML = mathml.substring(i, end + 1);
                toReturn += '&#' + wrs_fixedCharCodeAt((container.innerText || container.textContent),0) + ';';
                i = end;
            }
            else {
                toReturn += character;
            }
        }
        else {
            toReturn += character;
        }
    }

    return toReturn;
}

/**
 * Add wrs::type attribute to mathml if the mathml has been created with a custom editor
 * for example, chemistry.
 * @param {string} mathml a MathML string created with a custom editor, like chemistry.
 * @return {string} The MathML string with his class containgin the editor toolbar string.
 * @ignore
 */
function wrs_mathmlAddEditorAttribute(mathml) {
    var toReturn = '';

    var start = mathml.indexOf('<math');
    if (start == 0 ) {
        end = mathml.indexOf('>');
        if (mathml.indexOf("class") == -1 ) {
            // Adding custom editor type.
            toReturn = mathml.substr(start, end) + ' class="wrs_' + wrs_int_getCustomEditorEnabled().toolbar + '">';
            toReturn += mathml.substr(end + 1, mathml.length);
            return toReturn;
        }
    }
    return mathml;

}

/**
 * Fix charCodeAt() javascript function to handle non-Basic-Multilingual-Plane characters.
 * @param {string} str String
 * @param {int} idx An integer greater than or equal to 0 and less than the length of the string
 * @return {int} An integer representing the UTF-16 code of the string at the given index.
 * @ignore
 */

function wrs_fixedCharCodeAt(str, idx) {
    idx = idx || 0;
    var code = str.charCodeAt(idx);
    var hi, low;

    /* High surrogate (could change last hex to 0xDB7F to treat high
    private surrogates as single characters) */

    if (0xD800 <= code && code <= 0xDBFF) {
        hi = code;
        low = str.charCodeAt(idx + 1);
        if (isNaN(low)) {
            throw 'High surrogate not followed by low surrogate in fixedCharCodeAt()';
        }
        return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
    }

    if (0xDC00 <= code && code <= 0xDFFF) { // Low surrogate.
        /* We return false to allow loops to skip this iteration since should have
           already handled high surrogate above in the previous iteration. */
        return false;
    }
    return code;
}

/**
 * Gets the accessible text of a given MathML calling mathml2accesible service.
 * @param {string} mathml MathML to get the accesibility.
 * @param {string} language Language of the accesibility.
 * @return {string} Accessibility from mathml string on language string.
 * @ignore
 */
function wrs_mathmlToAccessible(mathml, language, data) {
    var accessibleText;

    if (_wrs_int_AccessibleCache.hasOwnProperty(mathml)) {
        accessibleText = _wrs_int_AccessibleCache[mathml];
    }
    else {
        data['service'] = 'mathml2accessible';
        var accessibleText = wrs_getContent(_wrs_conf_servicePath, data);
    }

    return accessibleText;

}

/**
 * Converts mathml to an iframe object.
 * @param {object} windowTarget Window object.
 * @param {string} mathml MathML to be converted.
 * @return {object} iframe object containging parsed mathml.
 * @ignore
 */
function wrs_mathmlToIframeObject(windowTarget, mathml) {
    if (window.navigator.userAgent.toLowerCase().indexOf('webkit') != -1) {
        // In WebKit, the formula is represented by a div instead of an iframe.
        var container = windowTarget.document.createElement('span');
        container.className = _wrs_conf_imageClassName;
        container.setAttribute(_wrs_conf_imageMathmlAttribute, mathml);
        container.setAttribute('height', '1');
        container.setAttribute('width', '1');
        container.style.display = 'inline-block';
        container.style.cursor = 'pointer';
        container.style.webkitUserModify = 'read-only';
        container.style.webkitUserSelect = 'all';

        var formulaContainer = windowTarget.document.createElement('span');
        formulaContainer.style.display = 'inline';
        container.appendChild(formulaContainer);

        function waitForViewer() {
            if (windowTarget.com && windowTarget.com.wiris) {
                if (!('_wrs_viewer' in windowTarget)) {
                    windowTarget._wrs_viewer = new windowTarget.com.wiris.jsEditor.JsViewerMain(_wrs_conf_pluginBasePath + '/integration/editor');
                    windowTarget._wrs_viewer.insertCSS(null, windowTarget.document);
                }

                windowTarget._wrs_viewer.paintFormulaOnContainer(mathml, formulaContainer, null);

                function prepareDiv() {
                    if (windowTarget._wrs_viewer.isReady()) {
                        container.style.height = formulaContainer.style.height;
                        container.style.width = formulaContainer.style.width;
                        container.style.verticalAlign = formulaContainer.style.verticalAlign;
                    }
                    else {
                        setTimeout(prepareDiv, 100);
                    }
                };

                prepareDiv();
            }
            else {
                setTimeout(waitForViewer, 100);
            }
        }

        if (!('_wrs_viewerAppended' in windowTarget)) {
            var viewerScript = windowTarget.document.createElement('script');
            viewerScript.src = _wrs_conf_pluginBasePath + '/integration/editor/viewer.js';
            windowTarget.document.getElementsByTagName('head')[0].appendChild(viewerScript);
            windowTarget._wrs_viewerAppended = true;
        }

        waitForViewer();

        return container;
    }

    windowTarget.document.wrs_assignIframeEvents = function (myIframe) {
        wrs_addEvent(myIframe.contentWindow.document, 'click', function () {
            wrs_fireEvent(myIframe, 'dblclick');
        });
    };

    var iframe = windowTarget.document.createElement('iframe');
    iframe.className = _wrs_conf_imageClassName;
    iframe.setAttribute(_wrs_conf_imageMathmlAttribute, mathml);
    iframe.style.display = 'inline';
    iframe.style.border = 'none';
    iframe.setAttribute('height', '1');
    iframe.setAttribute('width', '1');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameBorder', '0');
    iframe.src = _wrs_conf_pluginBasePath + '/core/iframe.html#' + _wrs_conf_imageMathmlAttribute;
    return iframe;
}

/**
 * Converts mathml to img object.
 * @param {object} creator Object with the "createElement" method
 * @param {string} mathml MathML code
 * @param {object} wirisProperties object containing WIRIS custom properties
 * @param {language} language Custom language for accesibility.
 * @return {object} And image containing the formula image corresponding to mathml string.
 * @ignore
 */
function wrs_mathmlToImgObject(creator, mathml, wirisProperties, language) {
    var width;
    var height;
    var baseline;
    var imgObject = creator.createElement('img');
    imgObject.align = 'middle';

    var data = (wirisProperties) ? wirisProperties : {};

    if (window._wrs_conf_useDigestInsteadOfMathml && _wrs_conf_useDigestInsteadOfMathml) {
        data['returnDigest'] = 'true';
    }

    data['mml'] = mathml;
    data['lang'] = language;

    if (_wrs_conf_setSize) {
        // Request metrics of the generated image.
        data['metrics'] = 'true';
        data['centerbaseline'] = 'false';
    }

    // Full base64 method (edit & save).
    if (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'default') {
        data['base64'] = true;
    }

    // Render js params: _wrs_int_wirisProperties contains some js render params. Since mathml can support render params, js params should be send only to editor, not to render.

    imgObject.className = _wrs_conf_imageClassName;

    // TODO Custom Editors: class="wrs_toolbar" should be given by the editor
    // so the first condition shouldn't be longer necessary.
    if (customEditor = wrs_int_getCustomEditorEnabled()) {
        imgObject.setAttribute('data-custom-editor', customEditor.toolbar);
    } else if (mathml.indexOf('class="') != -1) { // We check here if the mathmnl has been created from a customEditor (such chemistry)
        // to add data-custom-editor attribute to img object (if necessary).
        mathmlSubstring = mathml.substring(mathml.indexOf('class="') + 'class="'.length, mathml.length);
        mathmlSubstring = mathmlSubstring.substring(0, mathmlSubstring.indexOf('"'));
        mathmlSubstring = mathmlSubstring.substring(4,mathmlSubstring.length);
        imgObject.setAttribute('data-custom-editor', mathmlSubstring);
    }

    // Performance enabled.
    if (_wrs_conf_wirisPluginPerformance && (_wrs_conf_saveMode == 'xml' || _wrs_conf_saveMode == 'safeXml')) {

        var result = JSON.parse(wrs_createShowImageSrc(mathml, data, language));
        if (result["status"] == 'warning') {
            // POST call.
             result = JSON.parse(wrs_getContent(_wrs_conf_showimagePath, data));
        }
        result = result.result;
        if (result['format'] == 'png') {
            imgObject.src = 'data:image/png;base64,' + result['content'];
        } else {
            imgObject.src = 'data:image/svg+xml;charset=utf8,' + wrs_urlencode(result['content']);
        }
        imgObject.setAttribute(_wrs_conf_imageMathmlAttribute, wrs_mathmlEncode(mathml));
        if (_wrs_conf_setSize) {
            wrs_setImgSize(imgObject, result['content'], true);
        }

        if (window._wrs_conf_enableAccessibility && _wrs_conf_enableAccessibility) {
            if (typeof result.alt == 'undefined') {
                imgObject.alt = wrs_mathmlToAccessible(mathml, language, data);
                wrs_populateAccessibleCache(mathml, imgObject.alt);
            }
            else {
                imgObject.alt = result.alt;
            }
        }
    }
    else {
        var result = wrs_createImageSrc(mathml, data);
        if (window._wrs_conf_useDigestInsteadOfMathml && _wrs_conf_useDigestInsteadOfMathml) {
            var parts = result.split(':', 2);
            imgObject.setAttribute(_wrs_conf_imageMathmlAttribute, parts[0]);
            imgObject.src = parts[1];
        }
        else {
            imgObject.setAttribute(_wrs_conf_imageMathmlAttribute, wrs_mathmlEncode(mathml));
            imgObject.src = result;
            if (_wrs_conf_setSize) {
                wrs_setImgSize(imgObject,result, (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'default') ? true : false);
            }
        }
        if (window._wrs_conf_enableAccessibility && _wrs_conf_enableAccessibility) {
            imgObject.alt = wrs_mathmlToAccessible(mathml, language, data);
            wrs_populateAccessibleCache(mathml, imgObject.alt);
        }
    }
    /* if (_wrs_conf_setSize) {
        var ar = wrs_urlToAssArray(result);
        width = ar['cw'];
        height = ar['ch'];
        baseline = ar['cb'];
        dpi = ar['dpi'];
        if (dpi) {
            width = width * 96/dpi;
            height = height * 96/dpi;
            baseline = baseline * 96/dpi;
        }
        // result = wrs_assArrayToUrl(ar);
    }*/

    if (typeof wrs_observer != 'undefined') {
        wrs_observer.observe(imgObject, wrs_observer_config);
    }

    // Role math https://www.w3.org/TR/wai-aria/roles#math.
    imgObject.setAttribute('role', 'math');
    return imgObject;
}

/**
 * Opens a new CAS window.
 * @param {object} target The editable element
 * @param {boolean} isIframe Specifies if target is an iframe or not
 * @param {string} language CAS language.
 * @return {object} The opened window
 * @ignore
 */
function wrs_openCASWindow(target, isIframe, language) {
    if (isIframe === undefined) {
        isIframe = true;
    }

    _wrs_temporalRange = null;

    if (target) {
        var selectedItem = wrs_getSelectedItem(target, isIframe);

        if (selectedItem != null && selectedItem.caretPosition === undefined && selectedItem.node.nodeName.toUpperCase() == 'IMG' && selectedItem.node.className == _wrs_conf_CASClassName) {
            _wrs_temporalImage = selectedItem.node;
            _wrs_isNewElement = false;
        }
    }

    var path = _wrs_conf_CASPath;

    if (language) {
        path += '?lang=' + language;
    }

    return window.open(path, 'WIRISCAS', _wrs_conf_CASAttributes);
}

/**
 * Opens a new editor window.
 * @param {string} language Language code for the editor
 * @param {object} target The editable element
 * @param {boolean} isIframe Specifies if the target is an iframe or not
 * @param {boolean} isModal Specifies if the target is a modal window or not
 * @return {object} The opened window
 * @ignore
 */
function wrs_openEditorWindow(language, target, isIframe) {
    var ua = navigator.userAgent.toLowerCase();
    var isAndroid = ua.indexOf("android") > -1;
    var isIOS = ((ua.indexOf("ipad") > -1) || (ua.indexOf("iphone") > -1));

    if(isAndroid || isIOS) {
        _wrs_conf_modalWindow = true; // Conf property must be overrided on tablet/phone devices.
    }

    try {
        var selection = target.contentWindow.getSelection();
        _wrs_range = selection.getRangeAt(0);
    }
    catch (e) {
        _wrs_range = null;
    }

    if (isIframe === undefined) {
        isIframe = true;
    }

    // Avoid double slashes.
    var path = _wrs_conf_path.lastIndexOf('/') == _wrs_conf_path.length - 1 ? _wrs_conf_path + "core/editor.html" : _wrs_conf_path + "/core/editor.html";

    if (language) {
        path = wrs_addArgument(path, "lang", language);
    }

    if (location.protocol == 'https:') {
        path = wrs_addArgument(path, "secure", "true");
    }

    var availableDirs = new Array('rtl', 'ltr');
    if (typeof _wrs_int_directionality != 'undefined' && wrs_arrayContains(availableDirs, _wrs_int_directionality) != -1){
        path = wrs_addArgument(path,"dir",_wrs_int_directionality);
    }

    // Cross Domain Policy.
    wrs_addArgument(path, 'host', 'localhost');

    _wrs_editMode = (window._wrs_conf_defaultEditMode) ? _wrs_conf_defaultEditMode : 'images';
    _wrs_temporalRange = null;

    if (target) {
        var selectedItem;
        if (typeof wrs_int_getSelectedItem != 'undefined') {
            selectedItem = wrs_int_getSelectedItem(target, isIframe);
        } else {
            selectedItem = wrs_getSelectedItem(target, isIframe);
        }

        if (selectedItem != null) {
            if (selectedItem.caretPosition === undefined) {
                if (wrs_containsClass(selectedItem.node, _wrs_conf_imageClassName)) {
                    if (selectedItem.node.nodeName.toUpperCase() == 'IMG') {
                        _wrs_editMode = 'images';
                    }
                    else if (selectedItem.node.nodeName.toUpperCase() == 'IFRAME') {
                        _wrs_editMode = 'iframes';
                    }

                    _wrs_temporalImage = selectedItem.node;
                    _wrs_isNewElement = false;
                }
            }
            else {
                var latexResult = wrs_getLatexFromTextNode(selectedItem.node, selectedItem.caretPosition);

                if (latexResult != null) {
                    _wrs_editMode = 'latex';

                    var mathml = wrs_getMathMLFromLatex(latexResult.latex);
                    _wrs_isNewElement = false;

                    _wrs_temporalImage = document.createElement('img');
                    _wrs_temporalImage.setAttribute(_wrs_conf_imageMathmlAttribute, wrs_mathmlEncode(mathml));
                    var windowTarget = (isIframe) ? target.contentWindow : window;

                    if (document.selection) {
                        var leftOffset = 0;
                        var previousNode = latexResult.startNode.previousSibling;

                        while (previousNode) {
                            leftOffset += wrs_getNodeLength(previousNode);
                            previousNode = previousNode.previousSibling;
                        }

                        _wrs_temporalRange = windowTarget.document.selection.createRange();
                        _wrs_temporalRange.moveToElementText(latexResult.startNode.parentNode);
                        _wrs_temporalRange.move('character', leftOffset + latexResult.startPosition);
                        _wrs_temporalRange.moveEnd('character', latexResult.latex.length + 4); // Plus 4 for the '$$' characters.
                    }
                    else {
                        _wrs_temporalRange = windowTarget.document.createRange();
                        _wrs_temporalRange.setStart(latexResult.startNode, latexResult.startPosition);
                        _wrs_temporalRange.setEnd(latexResult.endNode, latexResult.endPosition);
                    }
                }
            }
        }
    }

    var title = wrs_int_getCustomEditorEnabled() != null ? wrs_int_getCustomEditorEnabled().title : 'WIRIS EDITOR math';
    if (!_wrs_conf_modalWindow) {
        _wrs_popupWindow = window.open(path, title, _wrs_conf_editorAttributes);
        return _wrs_popupWindow;
    }
    else {
        if (_wrs_modalWindow == null) {
            _wrs_modalWindow = new ModalWindow(path, _wrs_conf_editorAttributes);
        }
        if (!_wrs_css_loaded) {
            var fileref = document.createElement("link");
            fileref.setAttribute("rel", "stylesheet");
            fileref.setAttribute("type", "text/css");
            fileref.setAttribute("href", window.parent._wrs_conf_path + '/core/modal.css');
            document.getElementsByTagName("head")[0].appendChild(fileref);
            _wrs_css_loaded = true;
        }
        _wrs_modalWindow.setTitle(title);
        _wrs_modalWindow.open();
    }
}



/**
 * Converts all occurrences of mathml code to LATEX. The MathML code should containg <annotation encoding="LaTeX"/> to be converted.
 * @param {string} content A string containing MathML valid code.
 * @return {string} String with all MathML annotated occurrences replaced by the corresponding LaTeX code.
 * @ignore
 */
function wrs_parseMathmlToLatex(content, characters){
    var output = '';
    var mathTagBegin = characters.tagOpener + 'math';
    var mathTagEnd = characters.tagOpener + '/math' + characters.tagCloser;
    var openTarget = characters.tagOpener + 'annotation encoding=' + characters.doubleQuote + 'LaTeX' + characters.doubleQuote + characters.tagCloser;
    var closeTarget = characters.tagOpener + '/annotation' + characters.tagCloser;
    var start = content.indexOf(mathTagBegin);
    var end = 0;
    var mathml, startAnnotation, closeAnnotation;

    while (start != -1) {
        output += content.substring(end, start);
        end = content.indexOf(mathTagEnd, start);

        if (end == -1) {
            end = content.length - 1;
        }
        else {
            end += mathTagEnd.length;
        }

        mathml = content.substring(start, end);

        startAnnotation = mathml.indexOf(openTarget);
        if (startAnnotation != -1){
            startAnnotation += openTarget.length;
            closeAnnotation = mathml.indexOf(closeTarget);
            var latex = mathml.substring(startAnnotation, closeAnnotation);
            if (characters == _wrs_safeXmlCharacters) {
                latex = wrs_mathmlDecode(latex);
            }
            output += '$$' + latex + '$$';
            // Populate latex into cache.
            wrs_populateLatexCache(latex, mathml);
        }else{
            output += mathml;
        }

        start = content.indexOf(mathTagBegin, end);
    }

    output += content.substring(end, content.length);
    return output;
}

/**
 * Converts all occurrences of mathml code to the corresponding image.
 * @param {string} content An string with valid MathML code.
 * @param {object} characters An object containing xmlCharacters or safeXmlCharacters relation.
 * @param {string} language String containging a valid language code in order to generate formula accesibilty.
 * @return {string} The input string with all the MathML ocurrences replaced by the corresponding image.
 * @ignore
 */
function wrs_parseMathmlToImg(content, characters, language) {
    var output = '';
    var mathTagBegin = characters.tagOpener + 'math';
    var mathTagEnd = characters.tagOpener + '/math' + characters.tagCloser;
    var start = content.indexOf(mathTagBegin);
    var end = 0;

    while (start != -1) {
        output += content.substring(end, start);
        // Avoid WIRIS images to be parsed.
        imageMathmlAtrribute = content.indexOf(_wrs_conf_imageMathmlAttribute);
        end = content.indexOf(mathTagEnd, start);

        if (end == -1) {
            end = content.length - 1;
        } else if (imageMathmlAtrribute != -1) {
            // First close tag of img attribute
            // If a mathmlAttribute exists should be inside a img tag.
            end += content.indexOf("/>", start);
        }
        else {
            end += mathTagEnd.length;
        }

        if (!wrs_isMathmlInAttribute(content, start) && imageMathmlAtrribute == -1){
            var mathml = content.substring(start, end);
            mathml = (characters == _wrs_safeXmlCharacters) ? wrs_mathmlDecode(mathml) : wrs_mathmlEntities(mathml);
            output += wrs_createObjectCode(wrs_mathmlToImgObject(document, mathml, null, language));
        }
        else {
            output += content.substring(start, end);
        }

        start = content.indexOf(mathTagBegin, end);
    }

    output += content.substring(end, content.length);
    return output;
}

/**
 * Converts all occurrences of safe applet code to the corresponding code.
 * @param {string} content String containging valid applet code <APPLET>...</APPLET>
 * @return {string} String with all the applet code conerted to safe tags.
 * @ignore
 */
function wrs_parseSafeAppletsToObjects(content) {
    var output = '';
    var appletTagBegin = _wrs_safeXmlCharacters.tagOpener + 'APPLET';
    var appletTagEnd = _wrs_safeXmlCharacters.tagOpener + '/APPLET' + _wrs_safeXmlCharacters.tagCloser;
    var upperCaseContent = content.toUpperCase();
    var start = upperCaseContent.indexOf(appletTagBegin);
    var end = 0;
    var applet;

    while (start != -1) {
        output += content.substring(end, start);
        end = upperCaseContent.indexOf(appletTagEnd, start);

        if (end == -1) {
            end = content.length - 1;
        }
        else {
            end += appletTagEnd.length;
        }

        applet = wrs_convertOldXmlinitialtextAttribute(content.substring(start, end));

        output += wrs_mathmlDecode(applet);
        start = upperCaseContent.indexOf(appletTagBegin, end);
    }

    output += content.substring(end, content.length);
    return output;
}

/**
 * Cross-browser removeEventListener/detachEvent function.
 * @param {object} element Element target
 * @param {event} event Event
 * @param {function} func Function to run
 * @ignore
 */
function wrs_removeEvent(element, event, func) {
    if (element.removeEventListener) {
        element.removeEventListener(event, func, true);
    }
    else if (element.detachEvent) {
        element.detachEvent('on' + event, func);
    }
}

/**
 * Splits an HTML content in three parts: the code before <body>, the code between <body> and </body> and the code after </body>.
 * @param {string} code HTML code to be splited.
 * @return {objet} An object with the structure {'prefix': xxx, 'code': yyy, 'sufix': zzz}
 * @ignore
 */
function wrs_splitBody(code) {
    var prefix = '';
    var sufix = '';
    var bodyPosition = code.indexOf('<body');

    if (bodyPosition != -1) {
        bodyPosition = code.indexOf('>', bodyPosition);

        if (bodyPosition != -1) {
            ++bodyPosition;
            var endBodyPosition = code.indexOf('</body>', bodyPosition);

            if (endBodyPosition == -1) {
                endBodyPosition = code.length;
            }

            prefix = code.substring(0, bodyPosition);
            sufix = code.substring(endBodyPosition, code.length);
            code = code.substring(bodyPosition, endBodyPosition);
        }
    }

    return {
        'prefix': prefix,
        'code': code,
        'sufix': sufix
    };
}

/**
 * Inserts or modifies CAS.
 * @param {object} focusElement Element to be focused
 * @param {object} windowTarget Window where the editable content is
 * @param {string} appletCode Applet code
 * @param {string} image Base 64 image stream
 * @param {int} imageWidth Image width
 * @param {int} imageHeight Image height
 * @ignore
 */
function wrs_updateCAS(focusElement, windowTarget, appletCode, image, imageWidth, imageHeight) {
    var imgObject = wrs_appletCodeToImgObject(windowTarget.document, appletCode, image, imageWidth, imageHeight);
    wrs_insertElementOnSelection(imgObject, focusElement, windowTarget);
}

var wrs_PluginEvent = function () {
    this.cancelled = false;
    this.defaultPrevented = false;
}

wrs_PluginEvent.prototype.cancel = function () {
    this.cancelled = true;
}

wrs_PluginEvent.prototype.preventDefault = function () {
    this.defaultPrevented = true;
}

/**
 * Fires WIRIS plugin event listeners
 * @param  {String} eventName event name
 * @param  {Object} e         event properties
 * @return {bool}             false if event has been prevented.
 * @ignore
 */
function wrs_fireEventListeners(eventName, e) {
    for (var i = 0; i < wrs_pluginListeners.length && !e.cancelled; ++i) {
        if (wrs_pluginListeners[i][eventName]) {
            // Calling listener.
            wrs_pluginListeners[i][eventName](e);
        }
    }

    return e.defaultPrevented;
}

/**
 * Inserts or modifies formulas.
 * @param {object} focusElement Element to be focused
 * @param {object} windowTarget Window where the editable content is
 * @param {string} mathml Mathml code
 * @param {object} wirisProperties Extra attributes for the formula (like background color or font size).
 * @param {string} editMode Current edit mode.
 * @param {string} language Language for the formula.
 * @ignore
 */
function wrs_updateFormula(focusElement, windowTarget, mathml, wirisProperties, editMode, language) {
    // Before update listener.

    // Params on beforeUpdate listener
    // - mathml
    // - editMode (read only)
    // - wirisProperties
    // - language (read only).

    editMode = editMode !== null ? editMode : _wrs_editMode;
    var e = new wrs_PluginEvent();

    e.mathml = mathml;

    // Cloning wirisProperties object
    // We don't want wirisProperties object modified.
    e.wirisProperties = {};

    for (var attr in wirisProperties) {
        e.wirisProperties[attr] = wirisProperties[attr];
    }

    // Read only.
    e.language = language;
    e.editMode = editMode;

    if (wrs_fireEventListeners('onBeforeFormulaInsertion', e)) {
        return;
    }

    mathml = e.mathml;
    wirisProperties = e.wirisProperties;

    // Setting empty params for after.
    e = new wrs_PluginEvent();
    e.editMode = editMode;
    e.windowTarget = windowTarget;
    e.focusElement = focusElement;

    if (mathml.length == 0) {
        wrs_insertElementOnSelection(null, focusElement, windowTarget);
    }
    else if (editMode == 'latex') {
        e.latex = wrs_getLatexFromMathML(mathml);
        e.node = windowTarget.document.createTextNode('$$' + e.latex + '$$');
        wrs_populateLatexCache(e.latex, mathml);
        wrs_insertElementOnSelection(e.node, focusElement, windowTarget);
    }
    else if (editMode == 'iframes') {
        var iframe = wrs_mathmlToIframeObject(windowTarget, mathml);
        wrs_insertElementOnSelection(iframe, focusElement, windowTarget);
    }
    else {
        e.node = wrs_mathmlToImgObject(windowTarget.document, mathml, wirisProperties, language);
        wrs_insertElementOnSelection(e.node, focusElement, windowTarget);
    }

    if (wrs_fireEventListeners('onAfterFormulaInsertion', e)) {
        return;
    }
}

/**
 * Inserts or modifies formulas or CAS on a textarea.
 * @param {object} textarea Target
 * @param {string} text Text to add in the textarea. For example, if you want to add the link to the image, you can call this function as wrs_updateTextarea(textarea, wrs_createImageSrc(mathml));
 * @ignore
 */
function wrs_updateTextarea(textarea, text) {
    if (textarea && text) {
        textarea.focus();

        if (textarea.selectionStart != null) {
            textarea.value = textarea.value.substring(0, textarea.selectionStart) + text + textarea.value.substring(textarea.selectionEnd, textarea.value.length);
        }
        else {
            var selection = document.selection.createRange();
            selection.text = text;
        }
    }
}

/**
 * URL decode function.
 * @param {string} input String to be decoded
 * @return {string} decode string.
 * @ignore
 */
function wrs_urldecode(input) {
    return decodeURIComponent(input);
}

/**
 * URL encode function.
 * @param {string} clearString Input string to be encoded
 * @return {string} encoded string.
 * @ignore
 */
function wrs_urlencode(clearString) {
    var output = '';
    // Method encodeURIComponent doesn't encode !'()*~ .
    output = encodeURIComponent(clearString).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/~/g, '%7E');
    return output;
}

function wrs_addArgument(path,key,value) {
    if (path.indexOf("?") > 0) {
        sep = "&";
    } else {
        sep = "?";
    }
    return path + sep + key + "=" + value;
}

function wrs_urlToAssArray(url) {
    var i;
    i = url.indexOf("?");
    if (i > 0) {
        var query = url.substring(i + 1);
        var ss  = query.split("&");
        var h = new Object();
        for (i = 0; i < ss.length; i++) {
            var s = ss[i];
            var kv = s.split("=");
            if (kv.length > 1) {
                h[kv[0]] = decodeURIComponent(kv[1].replace(/\+/g, ' '));
            }
        }
        return h;
    } else {
        return new Object();
    }
}

function wrs_setImgSize(img, url, json) {

    if (json) {
        // Cleaning data:image/png;base64.
        if (_wrs_conf_imageFormat == 'svg') {
            var ar = getMetricsFromSvgString(url);
        } else {
            var base64String = img.src.substr( img.src.indexOf('base64,') + 7, img.src.length);
            bytes = wrs_b64ToByteArray(base64String, 88);
            var ar = wrs_getMetricsFromBytes(bytes);
        }
    } else {
        var ar = wrs_urlToAssArray(url);
    }
    var width = ar['cw'];
    if (!width) {
        return;
    }
    var height = ar['ch'];
    var baseline = ar['cb'];
    var dpi = ar['dpi'];
    if (dpi) {
        width = width * 96 / dpi;
        height = height * 96 / dpi;
        baseline = baseline * 96 / dpi;
    }
    img.width = width;
    img.height = height;
    img.style.verticalAlign = "-" + (height - baseline) + "px";
}

function wrs_fixAfterResize(img) {
    img.removeAttribute('style');
    img.removeAttribute('width');
    img.removeAttribute('height');
    if (_wrs_conf_setSize) {
        if (img.src.indexOf("data:image") != -1) {
            if (_wrs_conf_imageFormat == 'svg') {
                // ...data:image/svg+xml;charset=utf8, = 32.
                var svg = wrs_urldecode(img.src.substring(32, img.src.length))
                wrs_setImgSize(img, svg, true);
            } else {
                // ...data:image/png;base64, == 22.
                var base64 = img.src.substring(22,img.src.length);
                wrs_setImgSize(img, base64, true);
            }
        } else {
            wrs_setImgSize(img,img.src);
        }
    }
}

function wrs_initSetSize() {
    // Override _wrs_conf_setSize to align formulas when xml or safeXml mode are enabled.
    _wrs_conf_setSize = _wrs_conf_setSize || _wrs_conf_saveMode == 'xml' || _wrs_conf_saveMode == 'safeXml' || (_wrs_conf_saveMode == 'base64' && _wrs_conf_editMode == 'default');
}

function wrs_loadConfiguration() {
    if (typeof _wrs_conf_path == 'undefined') {
        // Discover path.
        var scriptName = "core/core.js";
        var col = document.getElementsByTagName("script");
        for (i = 0; i < col.length; i++) {
            var d;
            var src;
            d = col[i];
            src = d.src;
            var j = src.lastIndexOf(scriptName);
            if (j >= 0) {
                // That's my script!
                baseURL = src.substr(0, j - 1);
            }
        }
        _wrs_conf_path = baseURL;
    }

    var script = document.createElement('script');
    script.type = 'text/javascript';
    // Sometimes _wrs_conf_path contains a final "/" because is obtained using some editor's API.
    // With this variable we avoid URL's with doubles //.
    var newConfPath = _wrs_conf_path.lastIndexOf("/") == _wrs_conf_path.length - 1 ? _wrs_conf_path + _wrs_int_conf_file : _wrs_conf_path + "/" + _wrs_int_conf_file;
    var configUrl = _wrs_int_conf_file.indexOf("/") == 0 || _wrs_int_conf_file.indexOf("http") == 0 ? _wrs_int_conf_file : newConfPath;
    configUrl = configUrl.replace(/([^:]\/)\/+/g, "$1");
    script.src = configUrl;
    document.getElementsByTagName('head')[0].appendChild(script); // Asynchronous load of configuration.
}

var _wrs_conf_core_loaded = true;

if (typeof _wrs_conf_configuration_loaded == 'undefined') {
    wrs_loadConfiguration();
} else {
    _wrs_conf_plugin_loaded = true;
}



/**
 * Create modal window with embebbed iframe
 *
 * @param {string} title Modal window title
 * @param {object} iframeParams iframe attributes
 * @param {object} deviceProperties device properties like orientation, OS..
 * @param {object} modalProperites modal properties (like draggable).
 * @ignore
 */

function wrs_createModalWindow() {
    // Adding css stylesheet.
    if (!_wrs_css_loaded) {
        var fileref = document.createElement("link");
        fileref.setAttribute("rel", "stylesheet");
        fileref.setAttribute("type", "text/css");
        fileref.setAttribute("href", window.parent._wrs_conf_path + '/core/modal.css');
        document.getElementsByTagName("head")[0].appendChild(fileref);
        _wrs_css_loaded = true;
    }

    _wrs_modalWindow.open();
}

/**
 * Closes modal window
 */
function wrs_closeModalWindow() {
    wrs_int_disableCustomEditors();
    wrs_int_notifyWindowClosed();
    _wrs_editMode = (window._wrs_conf_defaultEditMode) ? _wrs_conf_defaultEditMode : 'images';
    _wrs_modalWindow.close();
}

/**
 * Create modal dialog for non mobile android devices.
 * @param  {modalDiv} modal overlay div.
 * @param  {containerDiv} modal window div.
 * @param  {iframe} embedded iframe.
 * @param  {iframeParams}  embedded iframe params (height, width).
 * @ignore
 */

function wrs_createModalWindowAndroid() {
    _wrs_modalWindowProperties.device = 'android';
    wrs_addClass(_wrs_modalWindow.iframeContainer, 'wrs_modal_android');
    _wrs_modalWindow.overlayDiv.className = _wrs_modalWindow.overlayDiv.className + " wrs_modal_android";
    _wrs_modalWindow.containerDiv.className = _wrs_modalWindow.containerDiv.className + " wrs_modal_android";
    _wrs_modalWindow.iframe.className = _wrs_modalWindow.iframe.className + " wrs_modal_android";
}

/**
 * Create modal dialog for non mobile iOS devices.
 * @param  {modalDiv} modal overlay div.
 * @param  {containerDiv} modal window div.
 * @param  {iframe} embedded iframe.
 * @param  {iframeParams}  embedded iframe params (height, width).
 * @ignore
 */
function wrs_createModalWindowIos() {
    wrs_addClass(iframeContainer, 'wrs_modal_ios');
    _wrs_modalWindow.overlayDiv.className = _wrs_modalWindow.overlayDiv.className + " wrs_modal_ios";
    if (typeof _wrs_isMoodle24 != 'undefined') {
        _wrs_modalWindow.overlayDiv.className = _wrs_modalWindow.overlayDiv.className + " moodle";
    }

    _wrs_modalWindow.containerDiv.className = _wrs_modalWindow.containerDiv.className + " wrs_modal_ios";
    _wrs_modalWindow.iframe.className = _wrs_modalWindow.iframe.className + " wrs_modal_ios";
}

/**
 * Create modal dialog for mobile devices.
 *
 * @param  {modalDiv} modal overlay div.
 * @param  {containerDiv} modal window div.
 * @param  {iframe} embedded iframe.
 * @param  {iframeParams}  embedded iframe params (height, width).
 * @ignore
 */

function wrs_createModalWindowMobile(modalDiv, containerDiv, iframe, iframeParams, iframeContainer) {

    wrs_addClass(_wrs_modalWindow.iframeContainer, 'wrs_modal_mobile');
    _wrs_modalWindow.overlayDiv.className = _wrs_modalWindow.overlayDiv.className + " wrs_modal_mobile";
    _wrs_modalWindow.containerDiv.className = _wrs_modalWindow.containerDiv.className + " wrs_modal_mobile";
    _wrs_modalWindow.iframe.className = _wrs_modalWindow.iframe.className + " wrs_modal_mobile";

    wrs_addMetaViewport("device-width", 1.0, 1.0, 1.0);

    var modalTitleBar = document.getElementsByClassName('wrs_modal_title')[0]

    if (modalTitleBar) {
        document.removeChild(modalTitleBar);
    }
}

/**
 * Create modal dialog for Androir mobile devices with an old stock browser (<=4.3).
 *
 * @param  {modalDiv} modal overlay div.
 * @param  {containerDiv} modal window div.
 * @param  {iframe} embedded iframe.
 * @param  {iframeParams}  embedded iframe params (height, width).
 * @ignore
 */
function wrs_createModalWindowBadStockAndroid(modalDiv, containerDiv, iframe, iframeParams) {
    _wrs_modalWindow.overlayDiv.className = _wrs_modalWindow.overlayDiv.className + " wrs_modal_badStock";
    _wrs_modalWindow.containerDiv.className = _wrs_modalWindow.containerDiv.className + " wrs_modal_badStock";
    _wrs_modalWindow.iframe.className = _wrs_modalWindow.iframe.className + " wrs_modal_badStock";

    if (window.outerWidth < parseInt(_wrs_modalWindowProperties.iframeAttributes['width'])) {
        var modalWidth = parseInt(_wrs_modalWindowProperties.iframeAttributes['width']) + 10;
        _wrs_modalWindow.containerDiv.style.width = _wrs_modalWindowProperties.iframeAttributes['width'] + 'px';
        _wrs_modalWindow.iframe.style.width = _wrs_modalWindowProperties.iframeAttributes['width'] + 'px';
    }

    window.addEventListener('orientationchange', function() {
        if (window.outerWidth > parseInt(_wrs_modalWindowProperties.iframeAttributes['width']) + 10) {
            var modalWidth = parseInt(_wrs_modalWindowProperties.iframeAttributes['width']) + 10;
            _wrs_modalWindow.containerDiv.style.width = modalWidth + 'px';
            _wrs_modalWindow.iframe.style.width = _wrs_modalWindowProperties.iframeAttributes['width'] + 'px';
        } else {
            _wrs_modalWindow.containerDiv.style.width = null;
            _wrs_modalWindow.iframe.style.width = null;
        }
    });

    wrs_addMetaViewport("device-width", 1.0, 1.0, 1.0);
}

/**
 * Add viewport header for scale control.
 *
 * @param {int} width  width of the layout viewport.
 * @param {int} initialScale Sets the initial zoom of the page and the width of the layout viewport.
 * @param {int} minimumScale Sets the minimum zoom level (i.e. how much the user can zoom out).
 * @param {int} maximumScale Sets the maximum zoom level (i.e. how much the user can zoom in).
 * @ignore
 */
function wrs_addMetaViewport(width, initialScale, minimumScale, maximumScale) {
    _wrs_originalMetaViewport = document.querySelector('meta[name=viewport]') ? document.querySelector('meta[name=viewport]').content : null;
    if (_wrs_originalMetaViewport) {
        document.querySelector('meta[name=viewport]').content = "width=" + width + ", initial-scale=" + initialScale + ", minimum-scale=" + minimumScale + ", maximum-scale=" + maximumScale;
    } else {
        var attributes = {};
        attributes['name'] = 'viewport';
        attributes['content'] = "width=" + width + ", initial-scale=" + initialScale + ", minimum-scale=" + minimumScale + ", maximum-scale=" + maximumScale;
        var meta = wrs_createElement('meta', attributes);
        document.getElementsByTagName("head")[0].appendChild(meta);
    }
}


/**
 * Android stock browser test
 * http://stackoverflow.com/questions/24926221/distinguish-android-chrome-from-stock-browser-stock-browsers-user-agent-contai
 *
 * @return {Boolean} true if user agent is from an Android stock browser (<= 4.3)
 * @ignore
 */
function wrs_isBadStockAndroid () {
    var userAgent = window.navigator.userAgent;
    // Android stock browser test derived from
    // http://stackoverflow.com/questions/24926221/distinguish-android-chrome-from-stock-browser-stock-browsers-user-agent-contai.
    var isAndroid = userAgent.indexOf(' Android ') > -1;
    if (!isAndroid) {
        return false;
    }

    var isStockAndroid = userAgent.indexOf('Version/') > -1;
    if (!isStockAndroid) {
        return false;
    }

    var versionNumber = parseFloat((userAgent.match('Android ([0-9.]+)') || [])[1]);
    // Anything below 4.4 uses WebKit without *any* viewport support.
    return versionNumber <= 4.3;
}

/**
 * Populates LaTeX cache into _wrs_int_LatexCache global variable.
 *
 * @param {string}latex LaTeX code (with $$ separators)
 * @param {string} mathml matml LaTeX translation.
 * @ignore
 */
function wrs_populateLatexCache(latex, mathml) {
    if (mathml.indexOf('semantics') == -1 && mathml.indexOf('annotation') == -1 ) {
        mathml = wrs_insertSemanticsMathml(mathml, latex);
    }
    if (!_wrs_int_LatexCache.hasOwnProperty(latex)) {
        _wrs_int_LatexCache[latex] = mathml;
    }
}

/**
 * Puts into _wrs_int_AccessibleCache global variable dictionary the pair mathml=>accessibleText.
 *
 * @param {string} mathml MatML text.
 * @param {string} accessibleText Image accessible text
 * @ignore
 */
function wrs_populateAccessibleCache(mathml, accessibleText) {
    if (!_wrs_int_AccessibleCache.hasOwnProperty(mathml)) {
        _wrs_int_AccessibleCache[mathml] = accessibleText;
    }
}

/**
 * Add annotation tag to mathml without it (mathml comes from LaTeX string)
 * @param  {string} mathml MathML code generated by a LaTeX string.
 * @param  {string} latex Original LaTeX string
 * @return {string} new mathml containing LaTeX code on annotation tag.
 * @ignore
 */
function wrs_insertSemanticsMathml(mathml, latex) {

    var firstEndTag = '>';
    var mathTagEnd = '<' + '/math' + '>';
    var openSemantics = '<' + 'semantics' + '>';
    var closeSemantics = '<' + '/semantics' + '>';
    var openTarget = '<annotation encoding="LaTeX">';
    var closeTarget = '<' + '/annotation' + '>';
    var mrowOpen = '<mrow>';
    var mrowClose = '</mrow>';

    var indexMathBegin = mathml.indexOf(firstEndTag);
    var indexMathEnd = mathml.indexOf(mathTagEnd);
    var mathBeginExists = mathml.substring(mathml.indexOf('<'), mathml.indexOf('>')).indexOf('math');

    if (indexMathBegin != -1 && indexMathEnd != -1 && mathBeginExists)  {
        var mathmlContent = mathml.substring(indexMathBegin + 1, indexMathEnd);
        if (mathmlContent.indexOf(mrowOpen) != 0) {
            var mathmlContentSemantics = openSemantics + mrowOpen + mathmlContent + mrowClose + openTarget + latex + closeTarget + closeSemantics;
        } else {
            var mathmlContentSemantics = openSemantics + mathmlContent + openTarget + latex + closeTarget + closeSemantics;
        }
        return mathml.replace(mathmlContent, mathmlContentSemantics);
    } else {
        return mathml;
    }

}

/**
 * Transform html img tags inside a html code to mathml, base64 img tags (i.e with base64 on src) or showimage img tags (i.e with showimage.php on src)
 *
 * @param  {String} code html code
 * @param  {String} mode base642showimage or img2mathml or img264 transform.
 * @return {String} html code transformed.
 * @ignore
 */
function wrs_codeImgTransform(code, mode) {
    output = '';

    var endPosition = 0;
    var pattern = /<img/gi;
    var patternLength = pattern.source.length;

    while (pattern.test(code)) {
        var startPosition = pattern.lastIndex - patternLength;
        output += code.substring(endPosition, startPosition);

        var i = startPosition + 1;

        while (i < code.length && endPosition <= startPosition) {
            var character = code.charAt(i);

            if (character == '"' || character == '\'') {
                var characterNextPosition = code.indexOf(character, i + 1);

                if (characterNextPosition == -1) {
                    i = code.length;        // End while.
                }
                else {
                    i = characterNextPosition;
                }
            }
            else if (character == '>') {
                endPosition = i + 1;
            }

            ++i;
        }

        if (endPosition < startPosition) {      // The img tag is stripped.
            output += code.substring(startPosition, code.length);
            return output;
        }
        var imgCode = code.substring(startPosition, endPosition);
        var imgObject = wrs_createObject(imgCode);
        var xmlCode = imgObject.getAttribute(_wrs_conf_imageMathmlAttribute);

        if (mode == 'base642showimage') {
            if (xmlCode == null) {
                xmlCode = imgObject.getAttribute('alt');
            }
            xmlCode = wrs_mathmlDecode(xmlCode);
            imgCode = wrs_mathmlToImgObject(document, xmlCode, null, null);
            output += wrs_createObjectCode(imgCode);
        } else if (mode == 'img2mathml') {
            if (window._wrs_conf_saveMode) {
                if (_wrs_conf_saveMode == 'safeXml') {
                    convertToXml = true;
                    convertToSafeXml = true;
                }
                else if (_wrs_conf_saveMode == 'xml') {
                    convertToXml = true;
                    convertToSafeXml = false;
                }
            }
            output += wrs_getWIRISImageOutput(imgCode, convertToXml, convertToSafeXml);
        } else if (mode == 'img264') {

            if (xmlCode == null) {
                xmlCode = imgObject.getAttribute('alt');
            }
            xmlCode = wrs_mathmlDecode(xmlCode);

            var properties = {};
            properties['base64'] = 'true';
            imgCode = wrs_mathmlToImgObject(document, xmlCode, properties, null)
            // Metrics.
            wrs_setImgSize(imgCode, imgCode.src, true);

            output += wrs_createObjectCode(imgCode);
        }
    }
    output += code.substring(endPosition, code.length);
    return output;
}

/**
 * Decode a base64 to its numeric value
 *
 * @param  {String} el base64 character.
 * @return {int} base64 char numeric value.
 * @ignore
 */
function wrs_decode64(el) {

    var PLUS = '+'.charCodeAt(0);
    var SLASH = '/'.charCodeAt(0);
    var NUMBER = '0'.charCodeAt(0);
    var LOWER = 'a'.charCodeAt(0);
    var UPPER = 'A'.charCodeAt(0);
    var PLUS_URL_SAFE = '-'.charCodeAt(0);
    var SLASH_URL_SAFE = '_'.charCodeAt(0);
    var code = el.charCodeAt(0);

    if (code === PLUS || code === PLUS_URL_SAFE) {
        return 62; // Char '+'.
    }
    if (code === SLASH || code === SLASH_URL_SAFE){
        return 63 // Char '/'.
    }
    if (code < NUMBER){
        return -1 // No match.
    }
    if (code < NUMBER + 10){
        return code - NUMBER + 26 + 26
    }
    if (code < UPPER + 26){
        return code - UPPER
    }
    if (code < LOWER + 26){
        return code - LOWER + 26
    }
}

/**
 * Converts a base64 string to a array of bytes.
 * @param  {String} b64String base64 string.
 * @param  {int} len dimension of byte array (by default whole string).
 * @return {Array} Byte array.
 * @ignore
 */
function wrs_b64ToByteArray(b64String, len) {

    var tmp;

    if (b64String.length % 4 > 0) {
        throw new Error('Invalid string. Length must be a multiple of 4'); // Tipped base64. Length is fixed.
    }

    var arr = new Array()

    if (!len) { // All b64String string.
        var placeHolders = b64String.charAt(b64String.length - 2) === '=' ? 2 : b64String.charAt(b64String.length - 1) === '=' ? 1 : 0
        var l = placeHolders > 0 ? b64String.length - 4 : b64String.length;
    } else {
        var l = len;
    }

    for (var i = 0; i < l; i += 4) {
        // Ignoring code checker standards (bitewise operators).
        // See https://tracker.moodle.org/browse/CONTRIB-5862 for further information.
        // @codingStandardsIgnoreStart
        tmp = (wrs_decode64(b64String.charAt(i)) << 18) | (wrs_decode64(b64String.charAt(i + 1)) << 12) | (wrs_decode64(b64String.charAt(i + 2)) << 6) | wrs_decode64(b64String.charAt(i + 3));

        arr.push((tmp  >> 16) & 0xFF);
        arr.push((tmp >> 8) & 0xFF);
        arr.push(tmp & 0xFF);
        // @codingStandardsIgnoreEnd
    }

    if (placeHolders) {
        if (placeHolders === 2) {
            // Ignoring code checker standards (bitewise operators).
            // @codingStandardsIgnoreStart
            tmp = (wrs_decode64(b64String.charAt(i)) << 2) | (wrs_decode64(b64String.charAt(i + 1)) >> 4);
            arr.push(tmp & 0xFF)
        } else if (placeHolders === 1) {
            tmp = (wrs_decode64(b64String.charAt(i)) << 10) | (wrs_decode64(b64String.charAt(i + 1)) << 4) | (wrs_decode64(b64String.charAt(i + 2)) >> 2)
            arr.push((tmp >> 8) & 0xFF);
            arr.push(tmp & 0xFF);
            // @codingStandardsIgnoreEnd
        }
    }

    return arr
}

/**
 * Returns the first 32-bit signed integer from a byte array.
 * @param  {Array} bytes array of bytes.
 * @return {int} 32-bit signed integer.
 * @ignore
 */
function wrs_readInt32(bytes) {
    if (bytes.length < 4) {
        return false;
    }
    var int32 = bytes.splice(0,4);
    // @codingStandardsIgnoreStart
    return (int32[0] << 24 | int32[1] << 16 | int32[2] <<  8 | int32[3] << 0);
    // @codingStandardsIgnoreEnd
}

/**
 * Read the first byte from a byte array.
 * @param  {array} bytes byte array.
 * @return {int} first byte of the byte array.
 * @ignore
 */
function wrs_readByte(bytes) {
    // @codingStandardsIgnoreStart
    return bytes.shift() << 0;
    // @codingStandardsIgnoreEnd

}

/**
 * Read an arbitrary number of bytes, from a fixed position on a byte array.
 * @param  {array} bytes byte array.
 * @param  {int} post start position.
 * @param  {int} len number of bytes to read.
 * @return {array} byte array.
 * @ignore
 */
function wrs_readBytes(bytes, pos, len) {
    return bytes.splice(pos, len);
}

/**
 * Get metrics (width, height, baseline and dpi) from a png's byte array.
 * @param  {array} bytes png byte array.
 * @return {array} An array containging the png's metrics.
 * @ignore
 */
function wrs_getMetricsFromBytes(bytes) {
    wrs_readBytes(bytes, 0, 8);
    alloc = 10;
    i = 0;
    while (bytes.length >= 4) {
        len = wrs_readInt32(bytes);
        typ = wrs_readInt32(bytes);
        if (typ == 0x49484452) {
            width = wrs_readInt32(bytes);
            height = wrs_readInt32(bytes);
            // Read 5 bytes.
            wrs_readInt32(bytes);
            wrs_readByte(bytes);
        } else if (typ == 0x62615345) { // Baseline: 'baSE'.
            baseline = wrs_readInt32(bytes);
        } else if (typ == 0x70485973) { // Dpis: 'pHYs'.
            dpi = wrs_readInt32(bytes);
            dpi = (Math.round(dpi / 39.37));
            wrs_readInt32(bytes);
            wrs_readByte(bytes);
        }
        wrs_readInt32(bytes);
    }

    if (typeof width != 'undefined') {
        var arr = new Array();
        arr['cw'] = width;
        arr['ch'] = height;
        arr['dpi'] = dpi;
        if (baseline) {
            arr['cb'] = baseline;
        }

        return arr;
    }
}

function getMetricsFromSvgString(svgString) {
    var first = svgString.indexOf('height="');
    var last = svgString.indexOf('"',first + 8, svgString.length);
    var height = svgString.substring(first + 8, last);

    first = svgString.indexOf('width="');
    last = svgString.indexOf('"',first + 7, svgString.length);
    var width = svgString.substring(first + 7, last);

    first = svgString.indexOf('wrs:baseline="');
    last = svgString.indexOf('"',first + 14, svgString.length);
    var baseline = svgString.substring(first + 14, last);

    if (typeof(width != 'undefined')) {
        var arr = new Array();
        arr['cw'] = width;
        arr['ch'] = height;
        if (typeof baseline != 'undefined') {
            arr['cb'] = baseline
        }

        return arr;
    }

}

/**
 * Get custom active editor
 * @ignore
 */
function wrs_int_getCustomEditorEnabled() {
    var customEditorEnabled = null;
    Object.keys(_wrs_int_customEditors).forEach(function(key) {
        if (_wrs_int_customEditors[key].enabled) {
            customEditorEnabled = _wrs_int_customEditors[key]
        }
    });

    return customEditorEnabled;
}

/**
 * Disable all custom editors
 * @ignore
 */
function wrs_int_disableCustomEditors(){
    Object.keys(_wrs_int_customEditors).forEach(function(key) {
            _wrs_int_customEditors[key].enabled = false;
    });
}

/**
 * Enable a custom editor
 * @param {string} editor a custom editor to be enabled
 * @ignore
 */
function wrs_int_enableCustomEditor(editor) {
    // Only one custom editor enabled at the same time.
    wrs_int_disableCustomEditors();
    if (_wrs_int_customEditors[editor]) {
        _wrs_int_customEditors[editor].enabled = true;
    }
}

/**
 * Convert a hash to string  sorting keys to get a deterministic output
 * @param {hash} h a key-value hash
 * @return{string} A string with the form key1=value1...keyn=valuen
 * @ignore
 */
function wrs_propertiesToString(h) {
    // 1. Sort keys. We sort the keys because we want a deterministic output.
    var keys = []
    for (var key in h) {
        if (h.hasOwnProperty(key)) {
            keys.push(key);
        }
    }

    var n = keys.length;
    for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
            var s1 = keys[i];
            var s2 = keys[j];
            if (wrs_compareStrings(s1,s2) > 0) {
                // Swap.
                keys[i] = s2;
                keys[j] = s1;
            }
        }
    }

    // 2. Generate output.
    var output = '';
    for (var i = 0; i < n; i++) {
        var key = keys[i];
        output += key;
        output += "=";
        var value = h[key];
        value = value.replace("\\", "\\\\");
        value = value.replace("\n", "\\n");
        value = value.replace("\r", "\\r");
        value = value.replace("\t", "\\t");

        output += value;
        output += "\n";
    }
    return output;
}

/**
 * Compare two strings using charCodeAt method
 * @param {string} a first string to compare.
 * @param {string} b second string to compare
 * @return {int} the int difference between a and b
 * @ignore
 */
function wrs_compareStrings(a, b){
    var i;
    var an = a.length;
    var bn = b.length;
    var n = (an > bn) ? bn : an;
    for(i = 0; i < n; i++){
        var c = wrs_fixedCharCodeAt(a,i) - wrs_fixedCharCodeAt(b,i);
        if(c != 0) {
            return c;
        }
    }
        return a.length - b.length;
}

// Polyfills.

if (!Object.keys) {
    Object.keys = (function () {
        'use strict';
        var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

        return function (obj) {
            if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
                throw new TypeError('Object.keys called on non-object');
            }

            var result = [], prop, i;

            for (prop in obj) {
                if (hasOwnProperty.call(obj, prop)) {
                    result.push(prop);
                }
            }

            if (hasDontEnumBug) {
                for (i = 0; i < dontEnumsLength; i++) {
                    if (hasOwnProperty.call(obj, dontEnums[i])) {
                        result.push(dontEnums[i]);
                    }
                }
            }
            return result;
        };
    }());
}

/**
 * Add a new callback to a WIRIS plugins listener.
 * @param {object} listener an Object containing listener name and a callback.
 */
function wrs_addPluginListener(listener) {
    wrs_pluginListeners.push(listener);
}

// Production steps of ECMA-262, Edition 5, 15.4.4.18
// Reference: http://es5.github.io/#x15.4.4.18.
if (!Array.prototype.forEach) {

    Array.prototype.forEach = function(callback, thisArg) {

        var T, k;

        if (this == null) {
            throw new TypeError(' this is null or not defined');
        }

        // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
        var O = Object(this);

        // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
        // 3. Let len be ToUint32(lenValue).

        // @codingStandardsIgnoreStart
        var len = O.length >>> 0;
        // @codingStandardsIgnoreEnd

        // 4. If IsCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11 .
        if (typeof callback !== "function") {
            throw new TypeError(callback + ' is not a function');
        }

        // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 1) {
            T = thisArg;
        }

        // 6. Let k be 0.
        k = 0;

        // 7. Repeat, while k < len.
        while (k < len) {

            var kValue;

            // A. Let Pk be ToString(k).
                // This is implicit for LHS operands of the in operator
            // B. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk
                // This step can be combined with c
            // C. If kPresent is true.
            if (k in O) {

                // I. Let kValue be the result of calling the Get internal method of O with argument Pk.
                kValue = O[k];

                // II. Call the Call internal method of callback with T as the this value and
                // argument list containing kValue, k, and O.
                callback.call(T, kValue, k, O);
            }
            // D. Increase k by 1.
            k++;
        }
        // 8. return undefined.
    };
}
