# Example integrating Mathtype and Enhanced Image plugins on CKEditor4

- [Executive Summary](#executive-summary)
- [Context](#context)
  - [Issues detected so far](#issues-detected-so-far)
- [Purpose](#purpose)
- [The example demo](#the-example-demo)
  - [How to run the demo](#how-to-run-the-demo)
  - [How to reproduce it](#how-to-reproduce-it)
- [Drawbacks](#drawbacks)
- [Bugs](#bugs)

## Executive Summary

**Enhanced image and MathType plugins for CKEditor4 can be considered compatibles and can be used together**, even though they both use the `img` tag for their own purposes and some [issues have been detected so far](#11-issues-detected-so-far).

You can download and try by yourself a [proof-of-concept demo](#how-to-try-it) using the [@wiris/mathtype-ckeditor4](https://www.npmjs.com/package/@wiris/mathtype-ckeditor4) package. 

Even though, there are some [drawbacks](#drawbacks) with this solution and, at least, [a bug has been detected](#bugs). 

We've prepared a step-by-step guide with the [custom integration settings](#how-to-reproduce-it) that need to be used in your source code.

## Context

MathType plugin allows to type and handwrite mathematical notation on the CKEditor and include quality math equations in the document.

The Enhanced Image is an optional plugin, introduced in CKEditor 4.3, that supports inserting images into the editor, and subsitutes the default 'image' plugin.

Both plugins affect the markup inside the editor and depend heavily on the `img` element manipulation and supports double-click event on it.

The Enhanced Image plugin offers these features to manage image elements:
- Dynamic "click and drag" resizing of images.
- Dynamic "click and drag" moving of images.
- An option to integrate image captions.
- An option to align images.

While MathType plugin uses some custom attributes and a predefined class on the affected 'img' elements, the Enhanced Image plugin wraps them with other different elements and accepts different configuration values and HTML templates to fit the user needs. 

Therefore, we can expect collisions between both CKEditor4 plugins when they are used at the same time.

### Issues detected so far

From the information reported from our clients and the Customer Success team, we've found that:

1. **Drag and drop *Image format mathematical formulas* doesn't work** as expected and stops working when errors appear on the console.
2. **Resize *Image format mathematical formulas* does not work**: the image is not resized.
3. **Changes made with MathType editor are lost** after an *Image format mathematical formulas* is edited with the "Enhanced Image" plugin, or dragged or aligned.


## Purpose

The purpose of this research is to build a CKEditor4 demo using Enhance Image and MathType plugins together in a way that solves and/or mitigates the issues mentioned above.

**The premise is to use the CKEditor API while not making any change on any of the plugins source code to integrate them togethere**.

At the same time, any unexpected behavior on the MathType plugin resulting of this experiment, will be registered as an issue in our backlog in order to be fixed whenever possible.

The deliveries are:

- An example demo and its source code
- A step by step guide

## The example demo

This example tries to show how to integrate succesfully both plugins in terms of user experience, and without making any change on code of any of the plugins.

![CKEditor4 with MathType + Image2 demo](./snapshot.png)

This demo allows to: 

1. **Edit Mathematical formulas** using MathType editor is allowed.
2. **Edit images** with the Enhanced Image editor is allowed.
3. **Align images and Mathematical formula** images.
4. **Move images and Mathematical formula** images around the editor's content: drag&drop and/or cut&paste.

### How to run the demo

1. Clone `html-integrations` repository
2. Checkout branch `KB-5603`
3. Follow these commands to run the demo:

```sh
    $ cd demos/html5/ckeditor4
    $ npm install
    $ npm start
```

Then follow these instructions to test the demo:

- Edit the formula with MathType editor to a different value
- Try the contextual menu on the formula image.
- Try the contextual menu on the image.
- Drag several times the new image on the editor's window.
- Resize the new image on the editor's window.
- Cut the formula using the contextual menu.
- Move the formula by pasting it somewhere else on the editor's window. 

### How to reproduce it:

We offer a step-by-step guide on how to build the previous step demo.

1. Clone `html-integrations` repository

2. Checkout branch `stable`

3. Edit `demos/html5/ckeditor4/app.js` and go the plugin inicialization part to add the `image2` and `justify` plugins like the following:

```Javascript
  // 1. Add the 'Enhanced Image' and 'Justify' plugins
  extraPlugins: 'ckeditor_wiris, image2, justify',
  removePlugins: 'image',
```
The `justify` plugin will allow us to align images, the same way the `image2` plugin does.

4. On the `instanceReady`, a few lines of code below, add a listener to the image contextual menu to avoid formulas being edited with the `Image2` plugin:

```Javascript
  // 2. Custom behavior for 'image2' plugin.
  // 2.1. Remove contextMenu item for Mathematical formulas rendered with MathType.
  if (evt.editor.contextMenu) {
    evt.editor.contextMenu.addListener(function(element, selection) {  
      if (element.hasClass('cke_widget_image')) {
        // Check if there's a Rendered Image formula from MathType
        var formula = element.$.getElementsByClassName('Wirisformula');
        if (formula.length > 0) {
            // Then, disable the Context menu for Image2.
            // First, save the items on a variable.
            var items = evt.editor.contextMenu.items;
            // Then, remove all context menu items.
            evt.editor.contextMenu.removeAll();
            // Finally, add them all again, except the 'image' context menu item.
            for (var i=0; i < items.length; i++) {
              if (items[i].command !== 'image') {
                evt.editor.contextMenu.add(items[i]);
              }
            } 
        }        
      }
    });
  }  
```

5. On the same `instanceReady` block, add the following to control the drag&drop behaviour.

```Javascript
  // 2.1. Control 'Enhanced Image' drag&drop behavior to mitigate errors using 'addUpcastCallback'.
  //      On an already edited image format math formula,
  //      the first attempt to drag works, the second raises an error. :shrug:
  //      It works fine and as expected with 'normal' and with, not previously edited MathType, formula images.
  //      @see: https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_plugins_widget_repository.html#method-addUpcastCallback
  CKEDITOR.instances.editor.widgets.addUpcastCallback( function( element ) {    
    // Check whether a MathType generated formula is present.    
    var e = element;
    do {
      if (e.children) e = e.children[0]; 
      if (e.name == 'img' && e.hasClass('Wirisformula')) {
        // So, image elements with the "Wirisformula" class will not be upcasted (e.g. to the Image2 widget).
        return false;
      }
    } while (e.children && e.children.length > 0) 
  });

```


6. Finally, in order to mitigate the errors when dragging formulas, use CSS to hide the resizer and dragger icons on Mathematical image formulas only.

```Javascript
  CKEDITOR.addCss('img.Wirisformula + span.cke_widget_drag_handler_container { display:none !important; } img.Wirisformula + span.cke_image_resizer, img.Wirisformula + span.cke_widget_drag_handler_container + span.cke_image_resizer { display:none !important; }');

```


## Drawbacks

There are some drawbacks on this solution, that are consistent with the behavior of the MathType plugin with the default CKEditor image plugin.

1. *Image format mathematical formulas* can't be edited with the Enhanced Image dialog form: the contextual menu item is not shown.
2. *Image format mathematical formulas* can't be resized with the Enhanced Image plugin: the resize feature is not visible.
3. *Image format mathematical formulas* can't be dragged once with the Enhanced Image plugin: the drag feature is not visible.

## Bugs

At the same time, we've identified this inconsistent behavior than can be considered a bug:

1. When a previously edited *Image format mathematical formulas* is been aligned using the [justify](https://ckeditor.com/cke4/addon/justify) plugin, the older value is shown again. Double-clicking the image format mathematical formula again, shows MathType editor with the new value again.