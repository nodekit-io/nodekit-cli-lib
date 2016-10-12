/*
* nodekit.io
*
* Copyright (c) 2016 OffGrid Networks. All Rights Reserved.
* Portions Copyright 2012 The Apache Software Foundation
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var path = require('path');

function addProperty(obj, property, modulePath) {
    // Add properties as getter to delay load the modules on first invocation
    Object.defineProperty(obj, property, {
        configurable: true,
        get: function () {
            var module = require(modulePath);
            // We do not need the getter any more
            obj[property] = module;
            return module;
        }
    });
}

exports = module.exports = {
    platforms : { 
        "nodekit-cli-android": path.join(__dirname, "lib", "nodekit-cli-android"),
        "nodekit-cli-ios": path.join(__dirname, "lib", "nodekit-cli-ios"),
        "nodekit-cli-osx": path.join(__dirname, "lib", "nodekit-cli-osx"),
        "nodekit-cli-windows": path.join(__dirname, "lib", "nodekit-cli-windows")
    }
};

addProperty(module.exports, 'nodekit-common', './lib/nodekit-common');
addProperty(module.exports, 'nodekit-fetch', './lib/nodekit-fetch');
addProperty(module.exports, 'nodekit-lib', './lib/nodekit-lib');
addProperty(module.exports, 'nodekit-serve', './lib/nodekit-serve');
