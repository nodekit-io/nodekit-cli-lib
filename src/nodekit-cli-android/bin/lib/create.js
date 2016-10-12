#!/usr/bin/env node

/*
       Licensed to OffGrid Networks (OGN) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  OGN licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/

var shell = require('shelljs'),
    Q     = require('q'),
    path  = require('path'),
    fs    = require('fs'),
    check_reqs = require('./check_reqs'),
    ROOT    = path.join(__dirname, '..', '..');

var MIN_SDK_VERSION = 14;

var NodeKitError = require('nodekit-cli-lib')['nodekit-common'].NodeKitError;
var AndroidManifest = require('../templates/nodekit/lib/AndroidManifest');

function setShellFatal(value, func) {
    var oldVal = shell.config.fatal;
    shell.config.fatal = value;
    func();
    shell.config.fatal = oldVal;
}

function getFrameworkDir(projectPath, shared) {
    return shared ? path.join(ROOT, 'framework') : path.join(projectPath, 'NodeKitLib');
}

function copyJsAndLibrary(projectPath, shared, projectName) {
    var nestedNodeKitLibPath = getFrameworkDir(projectPath, false);
    var srcNodeKitJsPath = path.join(ROOT, 'bin', 'templates', 'project', 'assets', 'www', 'nodekit.js');
    shell.cp('-f', srcNodeKitJsPath, path.join(projectPath, 'assets', 'www', 'nodekit.js'));

    // Copy the nodekit.js file to platforms/<platform>/platform_www/
    // The www dir is nuked on each prepare so we keep nodekit.js in platform_www
    shell.mkdir('-p', path.join(projectPath, 'platform_www'));
    shell.cp('-f', srcNodeKitJsPath, path.join(projectPath, 'platform_www'));

    // Copy nodekit-js-src directory into platform_www directory.
    // We need these files to build nodekit.js if using browserify method.
    shell.cp('-rf', path.join(ROOT, 'nodekit-js-src'), path.join(projectPath, 'platform_www'));

    // Don't fail if there are no old jars.
    setShellFatal(false, function() {
        shell.ls(path.join(projectPath, 'libs', 'nodekit-*.jar')).forEach(function(oldJar) {
            console.log('Deleting ' + oldJar);
            shell.rm('-f', oldJar);
        });
        var wasSymlink = true;
        try {
            // Delete the symlink if it was one.
            fs.unlinkSync(nestedNodeKitLibPath);
        } catch (e) {
            wasSymlink = false;
        }
        // Delete old library project if it existed.
        if (shared) {
            shell.rm('-rf', nestedNodeKitLibPath);
        } else if (!wasSymlink) {
            // Delete only the src, since Eclipse / Android Studio can't handle their project files being deleted.
            shell.rm('-rf', path.join(nestedNodeKitLibPath, 'src'));
        }
    });
    if (shared) {
        var relativeFrameworkPath = path.relative(projectPath, getFrameworkDir(projectPath, true));
        fs.symlinkSync(relativeFrameworkPath, nestedNodeKitLibPath, 'dir');
    } else {
        shell.mkdir('-p', nestedNodeKitLibPath);
        shell.cp('-f', path.join(ROOT, 'framework', 'AndroidManifest.xml'), nestedNodeKitLibPath);
        shell.cp('-f', path.join(ROOT, 'framework', 'project.properties'), nestedNodeKitLibPath);
        shell.cp('-f', path.join(ROOT, 'framework', 'build.gradle'), nestedNodeKitLibPath);
        shell.cp('-f', path.join(ROOT, 'framework', 'nodekit.gradle'), nestedNodeKitLibPath);
        shell.cp('-r', path.join(ROOT, 'framework', 'src'), nestedNodeKitLibPath);
    }
}

function extractSubProjectPaths(data) {
    var ret = {};
    var r = /^\s*android\.library\.reference\.\d+=(.*)(?:\s|$)/mg;
    var m;
    while ((m = r.exec(data))) {
        ret[m[1]] = 1;
    }
    return Object.keys(ret);
}

function writeProjectProperties(projectPath, target_api) {
    var dstPath = path.join(projectPath, 'project.properties');
    var templatePath = path.join(ROOT, 'bin', 'templates', 'project', 'project.properties');
    var srcPath = fs.existsSync(dstPath) ? dstPath : templatePath;

    var data = fs.readFileSync(srcPath, 'utf8');
    data = data.replace(/^target=.*/m, 'target=' + target_api);
    var subProjects = extractSubProjectPaths(data);
    subProjects = subProjects.filter(function(p) {
        return !(/^NodeKitLib$/m.exec(p) ||
                 /[\\\/]nodekit-android[\\\/]framework$/m.exec(p) ||
                 /^(\.\.[\\\/])+framework$/m.exec(p)
                 );
    });
    subProjects.unshift('NodeKitLib');
    data = data.replace(/^\s*android\.library\.reference\.\d+=.*\n/mg, '');
    if (!/\n$/.exec(data)) {
        data += '\n';
    }
    for (var i = 0; i < subProjects.length; ++i) {
        data += 'android.library.reference.' + (i+1) + '=' + subProjects[i] + '\n';
    }
    fs.writeFileSync(dstPath, data);
}

function prepBuildFiles(projectPath) {
    var buildModule = require(path.resolve(projectPath, 'nodekit/lib/builders/builders'));
    buildModule.getBuilder('gradle').prepBuildFiles();
}

function copyBuildRules(projectPath) {
    var srcDir = path.join(ROOT, 'bin', 'templates', 'project');

    shell.cp('-f', path.join(srcDir, 'build.gradle'), projectPath);
}

function copyScripts(projectPath) {
    var srcScriptsDir = path.join(ROOT, 'bin', 'templates', 'nodekit');
    var destScriptsDir = path.join(projectPath, 'nodekit');
    // Delete old scripts directory if this is an update.
    shell.rm('-rf', destScriptsDir);
    // Copy in the new ones.
    shell.cp('-r', srcScriptsDir, projectPath);
   
    //NODEKIT-START
     shell.cp('-r', path.join(ROOT, 'node_modules_copy'), destScriptsDir);
     shell.mv(path.join(destScriptsDir, 'node_modules_copy'), path.join(destScriptsDir, 'node_modules'));
    //NODEKIT-END

    shell.cp(path.join(ROOT, 'bin', 'check_reqs*'), destScriptsDir);
    shell.cp(path.join(ROOT, 'bin', 'lib', 'check_reqs.js'), path.join(projectPath, 'nodekit', 'lib', 'check_reqs.js'));
    shell.cp(path.join(ROOT, 'bin', 'android_sdk_version'), path.join(destScriptsDir, 'android_sdk_version'));
    shell.cp(path.join(ROOT, 'bin', 'lib', 'android_sdk_version.js'), path.join(projectPath, 'nodekit', 'lib', 'android_sdk_version.js'));
}

/**
 * Test whether a package name is acceptable for use as an android project.
 * Returns a promise, fulfilled if the package name is acceptable; rejected
 * otherwise.
 */
function validatePackageName(package_name) {
    //Make the package conform to Java package types
    //http://developer.android.com/guide/topics/manifest/manifest-element.html#package
    //Enforce underscore limitation
    var msg = 'Error validating package name. ';
    if (!/^[a-zA-Z][a-zA-Z0-9_]+(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(package_name)) {
        return Q.reject(new NodeKitError(msg + 'Package name must look like: com.company.Name'));
    }

    //Class is a reserved word
    if(/\b[Cc]lass\b/.test(package_name)) {
        return Q.reject(new NodeKitError(msg + '"class" is a reserved word'));
    }

    return Q.resolve();
}

/**
 * Test whether a project name is acceptable for use as an android class.
 * Returns a promise, fulfilled if the project name is acceptable; rejected
 * otherwise.
 */
function validateProjectName(project_name) {
    var msg = 'Error validating project name. ';
    //Make sure there's something there
    if (project_name === '') {
        return Q.reject(new NodeKitError(msg + 'Project name cannot be empty'));
    }

    //Enforce stupid name error
    if (project_name === 'NodeKitActivity') {
        return Q.reject(new NodeKitError(msg + 'Project name cannot be NodeKitActivity'));
    }

    //Classes in Java don't begin with numbers
    if (/^[0-9]/.test(project_name)) {
        return Q.reject(new NodeKitError(msg + 'Project name must not begin with a number'));
    }

    return Q.resolve();
}

/**
 * Creates an android application with the given options.
 *
 * @param   {String}  project_path  Path to the new NodeKit android project.
 * @param   {ConfigParser}  config  Instance of ConfigParser to retrieve basic
 *   project properties.
 * @param   {Object}  [options={}]  Various options
 * @param   {String}  [options.activityName='MainActivity']  Name for the
 *   activity
 * @param   {Boolean}  [options.link=false]  Specifies whether javascript files
 *   and NodeKitLib framework will be symlinked to created application.
 * @param   {String}  [options.customTemplate]  Path to project template
 *   (override)
 * @param   {EventEmitter}  [events]  An EventEmitter instance for logging
 *   events
 *
 * @return  {Promise<String>}  Directory where application has been created
 */
exports.create = function(project_path, config, options, events) {

    options = options || {};

    // Set default values for path, package and name
    project_path = path.resolve(project_path || 'NodeKitExample');
    // Check if project already exists
    if(fs.existsSync(project_path)) {
        return Q.reject(new NodeKitError('Project already exists! Delete and recreate'));
    }

    var package_name = config.packageName() || 'my.nodekit.project';
    var project_name = config.name() ?
        config.name().replace(/[^\w.]/g,'_') : 'NodeKitExample';

    var safe_activity_name = config.android_activityName() || options.activityName || 'MainActivity';
    var target_api      = check_reqs.get_target();

    //Make the package conform to Java package types
    return validatePackageName(package_name)
    .then(function() {
        validateProjectName(project_name);
    }).then(function() {
        // Log the given values for the project
        events.emit('log', 'Creating NodeKit project for the Android platform:');
        events.emit('log', '\tPath: ' + project_path);
        events.emit('log', '\tPackage: ' + package_name);
        events.emit('log', '\tName: ' + project_name);
        events.emit('log', '\tActivity: ' + safe_activity_name);
        events.emit('log', '\tAndroid target: ' + target_api);

        events.emit('verbose', 'Copying android template project to ' + project_path);

        setShellFatal(true, function() {
            var project_template_dir = options.customTemplate || path.join(ROOT, 'bin', 'templates', 'project');
            // copy project template
            //NODEKIT-START
           shell.mkdir('-p', path.join(project_path, 'assets'));
           shell.mkdir('-p', path.join(project_path, 'res'));
           //NODEKIT-END
        
            shell.cp('-r', path.join(project_template_dir, 'assets'), project_path);
            shell.cp('-r', path.join(project_template_dir, 'res'), project_path);
            shell.cp(path.join(project_template_dir, 'gitignore'), path.join(project_path, '.gitignore'));

            // Manually create directories that would be empty within the template (since git doesn't track directories).
            shell.mkdir(path.join(project_path, 'libs'));

            // copy nodekit.js, nodekit.jar
            copyJsAndLibrary(project_path, options.link, safe_activity_name);

            // interpolate the activity name and package
            var packagePath = package_name.replace(/\./g, path.sep);
            var activity_dir = path.join(project_path, 'src', packagePath);
            var activity_path = path.join(activity_dir, safe_activity_name + '.java');
            shell.mkdir('-p', activity_dir);
            shell.cp('-f', path.join(project_template_dir, 'Activity.java'), activity_path);
            shell.sed('-i', /__ACTIVITY__/, safe_activity_name, activity_path);
            shell.sed('-i', /__NAME__/, project_name, path.join(project_path, 'res', 'values', 'strings.xml'));
            shell.sed('-i', /__ID__/, package_name, activity_path);

            var manifest = new AndroidManifest(path.join(project_template_dir, 'AndroidManifest.xml'));
            manifest.setPackageId(package_name)
                .setTargetSdkVersion(target_api.split('-')[1])
                .getActivity().setName(safe_activity_name);

            var manifest_path = path.join(project_path, 'AndroidManifest.xml');
            manifest.write(manifest_path);

            copyScripts(project_path);
            copyBuildRules(project_path);
        });
        // Link it to local android install.
        writeProjectProperties(project_path, target_api);
        prepBuildFiles(project_path);
        events.emit('log', generateDoneMessage('create', options.link));
    }).thenResolve(project_path);
};

function generateDoneMessage(type, link) {
    var pkg = require('../../../../package');
    var msg = 'Android project ' + (type == 'update' ? 'updated ' : 'created ') + 'with ' + pkg.name + '@' + pkg.version;
    if (link) {
        msg += ' and has a linked NodeKitLib';
    }
    return msg;
}

// Returns a promise.
exports.update = function(projectPath, options, events) {
    options = options || {};

    return Q()
    .then(function() {

        var manifest = new AndroidManifest(path.join(projectPath, 'AndroidManifest.xml'));

        if (Number(manifest.getMinSdkVersion()) < MIN_SDK_VERSION) {
            events.emit('verbose', 'Updating minSdkVersion to ' + MIN_SDK_VERSION + ' in AndroidManifest.xml');
            manifest.setMinSdkVersion(MIN_SDK_VERSION);
        }

        manifest.setDebuggable(false).write();

        var projectName = manifest.getActivity().getName();
        var target_api = check_reqs.get_target();

        copyJsAndLibrary(projectPath, options.link, projectName);
        copyScripts(projectPath);
        copyBuildRules(projectPath);
        writeProjectProperties(projectPath, target_api);
        prepBuildFiles(projectPath);
        events.emit('log', generateDoneMessage('update', options.link));
    }).thenResolve(projectPath);
};


// For testing
exports.validatePackageName = validatePackageName;
exports.validateProjectName = validateProjectName;
