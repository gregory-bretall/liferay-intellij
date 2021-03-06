var fs = require('fs');
var highland = require('highland');
var streams5 = require('../streams6/streams5');

var getFilePath = streams5.getFilePath;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getComponentXML(component) {
	if (!component.content) {
		return '';
	}

	return '<component name="' + component.name + '">\n' + component.content + '\n</component>';
};

function getExcludeFolderElement(folder) {
	return '<excludeFolder url="file://$MODULE_DIR$/' + folder + '" />';
};

function getFacetManagerXML(module) {
	var facetManagerXML = [];

	if (module.webrootFolders.length > 0) {
		facetManagerXML = [
			'<facet type="web" name="' + module.moduleName + '">',
			'<configuration>',
			'<webroots>',
			'<root url="file://$MODULE_DIR$/' + module.webrootFolders[0] + '" relative="/" />',
			'</webroots>',
			'</configuration>',
			'</facet>'
		];
	}

	return facetManagerXML.join('\n');
};

function getIndent(indent) {
	return new Array(indent + 1).join('\t');
};

function getIntellijXML(fileData) {
	var xmlContent = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<module type="JAVA_MODULE" version="4">'
	];

	fileData.components
		.map(
			highland.ncurry(1, getComponentXML)
		)
		.filter(
			highland.compose(highland.not, highland.not)
		)
		.forEach(
			highland.ncurry(1, Array.prototype.push.bind(xmlContent))
		);

	xmlContent.push('</module>');

	return {
		name: fileData.fileName,
		content: xmlContent.join('\n')
	};
};

function getModuleIMLPath(module) {
	return getFilePath(module.modulePath, module.moduleName + '.iml');
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getOutputURLElements(module) {
	var outputFolder = 'classes';

	if (module.excludeFolders.indexOf('docroot/WEB-INF/classes') != -1) {
		outputFolder = 'docroot/WEB-INF/classes';
	}

	var outputURLElements = ['<output url="file://$MODULE_DIR$/' + outputFolder + '" />'];

	if (module.testSourceFolders.length > 0) {
		outputURLElements.push('<output-test url="file://$MODULE_DIR$/test-classes" />');
	}

	return outputURLElements;
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = getOutputURLElements(module);

	newModuleRootManagerXML.push('<content url="file://$MODULE_DIR$">');

	newModuleRootManagerXML = newModuleRootManagerXML.concat(
		module.sourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'false')),
		module.resourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-resource')),
		module.testSourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'true')),
		module.testResourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-test-resource')),
		module.excludeFolders.map(getExcludeFolderElement)
	);

	newModuleRootManagerXML.push('</content>');
	newModuleRootManagerXML.push('<orderEntry type="inheritedJdk" />');
	newModuleRootManagerXML.push('<orderEntry type="sourceFolder" forTests="false" />');

	return newModuleRootManagerXML.join('\n');
};

function getSourceFolderElement(attributeName, attributeValue, folder) {
	return '<sourceFolder url="file://$MODULE_DIR$/' + folder + '" ' +
		attributeName + '="' + attributeValue + '" />';
};

function saveContent(file) {
	var indent = 0;
	var splitContent = file.content.split('\n')
		.filter(highland.compose(highland.not, highland.not));

	for (var i = 0; i < splitContent.length; i++) {
		var line = splitContent[i].trim();
		splitContent[i] = getIndent(indent) + line;

		if (line.indexOf('<?') == 0) {
			continue;
		}

		if (line.indexOf('<') == -1) {
			splitContent[i] = getIndent(++indent) + line;
			continue;
		}

		if (line.indexOf('/>') != -1) {
			continue;
		}

		if (line.indexOf('<') == line.indexOf('</')) {
			splitContent[i] = getIndent(--indent) + line;
		}

		if (line.indexOf('</') == -1) {
			++indent;
		}
	}

	fs.writeFile(file.name, splitContent.join('\n'), function() {});
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getComponentXML = getComponentXML;
exports.getExcludeFolderElement = getExcludeFolderElement;
exports.getFacetManagerXML = getFacetManagerXML;
exports.getSourceFolderElement = getSourceFolderElement;
exports.getIntellijXML = getIntellijXML;
exports.getModuleIMLPath = getModuleIMLPath;
exports.getModuleXML = getModuleXML;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;
exports.getOutputURLElements = getOutputURLElements;
exports.saveContent = saveContent;