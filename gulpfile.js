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

var gulp = require('gulp');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var del = require('del');
var filter = require('gulp-filter');
var path = require('path');

function map(src, dest, cb) {
   var f = filter(['**', 
   '!node_modules/**/spec/**', 
   '!node_modules/**/tests/**',
   '!node_modules/**/test/**', 
   '!node_modules/**/node_modules/**', 
   '!node_modules/**/guides/**',
   '!node_modules/*-android/framework/src/org/apache/**',
   '!node_modules/*-android/*-js-src/**',
    '!node_modules/*-android/bin/templates/project/**',
   ]);
   var f2 = filter(['**', '!**/*.png'], {restore: true});
   
   gulp.src(src, { nodir: true })
     .pipe(f)
     .pipe(f2)
       .pipe(replace(/cordova/ig, function (match) { return matchCase("nodekit", match); }))
       .pipe(replace(/require\([\"\']nodekit-common[\"\']\)/ig, "require('nodekit-cli-lib')['nodekit-common']"))
       .pipe(replace(/require\([\"\']nodekit-fetch[\"\']\)/ig, "require('nodekit-cli-lib')['nodekit-fetch']"))
       .pipe(replace(/require\([\"\']nodekit-lib[\"\']\)/ig, "require('nodekit-cli-lib')['nodekit-lib']"))
       .pipe(replace(/require\([\"\']nodekit-serve[\"\']\)/ig, "require('nodekit-cli-lib')['nodekit-serve']"))
       .pipe(replace(/require\([\"\']nodekit-registry-mapper[\"\']\)/ig, "require('cordova-registry-mapper')"))
       .pipe(replace(/nodekit-js/ig, "cordova-js"))
       .pipe(replace(/Apache NodeKit /ig, "NodeKit "))
       .pipe(replace(/nodekit.apache.org/ig, "nodekit.io"))
       .pipe(replace(/org.apache.nodekit/ig, "io.nodekit"))
       .pipe(replace(/the Apache Software Foundation \(ASF\)/ig, "OffGrid Networks (OGN)"))
       .pipe(replace(/The ASF licenses/ig, "OGN licenses"))
       .pipe(replace(/nodekit-app-hello-world/ig, "nodekit-sample"))
       .pipe(replace(/gradle-2.13-all.zip/ig, "gradle-2.14.1-all.zip"))
       .pipe(replace(/[\"\']\.\/src\//ig, "'./"))
       .pipe(replace(/\.\.\/package/ig, "../../package"))   
       .pipe(f2.restore)
       .pipe(rename(function (path) {
        path.basename = indexify(path);
        path.dirname = path.dirname.replace(/cordova/ig,function(match) { return matchCase("nodekit", match); } );
    path.basename = path.basename.replace(/cordova/ig,function(match) { return matchCase("nodekit", match); } );
    }))
    .pipe(gulp.dest(dest))
    .on('end', cb);
}


function indexify(path) {
    if (path.dirname == "." && (path.basename == 'serve' || path.basename == 'cordova-common' || path.basename == 'cordova-lib'))
        return 'index'
    else
        return path.basename;
}

gulp.task("clean", function () {
    return del([
        'lib/nodekit-lib',
        'lib/nodekit-common',
        'lib/nodekit-fetch',
        'lib/nodekit-serve',
        'lib/nodekit-cli-android',
        'lib/nodekit-cli-ios',
        'lib/nodekit-cli-osx',
        'lib/nodekit-cli-windows',
        'lib/nodekit-cli-ubuntu'
    ]);
})

gulp.task("srccopy", ['lib', 'common', 'fetch', 'serve', 'android', 'ios', 'osx', 'windows', 'ubuntu'], function () {
    gulp.src("./src/**/*")
        .pipe(gulp.dest('./lib'));
})

gulp.task("lib", map.bind(null, ["./node_modules/cordova-lib/src/**/*", "./node_modules/cordova-lib/cordova-lib.js"], 'lib/nodekit-lib'));
gulp.task("common", map.bind(null, ["./node_modules/cordova-common/src/**/*", "./node_modules/cordova-common/cordova-common.js"], 'lib/nodekit-common'));
gulp.task("fetch", map.bind(null, "./node_modules/cordova-fetch/index.js", 'lib/nodekit-fetch'));
gulp.task("serve", map.bind(null, ["./node_modules/cordova-serve/src/**/*", "./node_modules/cordova-serve/serve.js"], 'lib/nodekit-serve'));

gulp.task("android", map.bind(null, "./node_modules/cordova-android/*/**", 'lib/nodekit-cli-android'));
gulp.task("ios", map.bind(null, "./node_modules/cordova-ios/*/**", 'lib/nodekit-cli-ios'));
gulp.task("osx", map.bind(null, "./node_modules/cordova-osx/*/**", "lib/nodekit-cli-osx"));
gulp.task("windows", map.bind(null, "./node_modules/cordova-windows/*/**", 'lib/nodekit-cli-windows'));
gulp.task("ubuntu", map.bind(null, "./node_modules/cordova-ubuntu/*/**", 'lib/nodekit-cli-ubuntu'));

gulp.task('refactor', ['lib', 'common', 'fetch', 'serve', 'android', 'ios', 'osx', 'windows', 'ubuntu', 'srccopy']);

function matchCase(text, pattern) {
    if (pattern == "Cordova" && text == "nodekit") return "NodeKit";

    var result = '';

    for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        var p = pattern.charCodeAt(i);

        if (p >= 65 && p < 65 + 26) {
            result += c.toUpperCase();
        } else {
            result += c.toLowerCase();
        }
    }

    return result;
}