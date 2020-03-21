# feezal element spec

Feezal elements MUST be published namespaced on npm.

Feezal element names MUST start with `feezal-element-<category>-`

The categories `basic` and `paper` are reserved.

A feezal element npm package MUST contain one and only one element that has the same tag name and file name as the 
package itself.


## attribute definitions

Attributes that should be shown in the Sidebar Editor have to be defined in `feezal.attributes`.

#### `name`

#### `dropdown`
* An array of options for a dropdown
* The string `"views"`

#### `tooltip`
