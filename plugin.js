/**
 * plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2015 Ephox Corp. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/*global tinymce:true */

tinymce.PluginManager.add('fulldocument', function(editor) {
	var each = tinymce.each, Node = tinymce.html.Node;
	var head, foot;

	/**
	 * @return void
	 * Open the fulldocument popup, loadding fulldocument header fragments in the
	 * proposed html form
	 */
	function showDialog() {
		var data = htmlToData();

		editor.windowManager.open({
			title: 'Document properties',
			data: data,
			defaults: {type: 'textbox', size: 40},
			body: [
				{name: 'title', label: 'Title'},
				{name: 'keywords', label: 'Keywords'},
				{name: 'description', label: 'Description'},
				{name: 'robots', label: 'Robots'},
				{name: 'author', label: 'Author'},
				{name: 'docencoding', label: 'Encoding'}
			],
			onSubmit: function(e) {
				dataToHtml(tinymce.extend(data, e.data));
			}
		});
	}

	/**
	 *
	 */
	function htmlToData() {
		var headerFragment = parseHeader(), data = {}, elm, matches;

		function getAttr(elm, name) {
			var value = elm.attr(name);

			return value || '';
		}

		// Default some values
		data.fontface = editor.getParam("fulldocument_default_fontface", "");
		data.fontsize = editor.getParam("fulldocument_default_fontsize", "");

		// Parse XML PI
		elm = headerFragment.firstChild;
		if (elm.type == 7) {
			data.xml_pi = true;
			matches = /encoding="([^"]+)"/.exec(elm.value);
			if (matches) {
				data.docencoding = matches[1];
			}
		}

		// Parse doctype
		elm = headerFragment.getAll('#doctype')[0];
		if (elm) {
			data.doctype = '<!DOCTYPE' + elm.value + ">";
		}

		// Parse title element
		elm = headerFragment.getAll('title')[0];
		if (elm && elm.firstChild) {
			data.title = elm.firstChild.value;
		}

		// Parse meta elements
		each(headerFragment.getAll('meta'), function(meta) {
			var name = meta.attr('name'), httpEquiv = meta.attr('http-equiv'), matches;

			if (name) {
				data[name.toLowerCase()] = meta.attr('content');
			} else if (httpEquiv == "Content-Type") {
				matches = /charset\s*=\s*(.*)\s*/gi.exec(meta.attr('content'));

				if (matches) {
					data.docencoding = matches[1];
				}
			}
		});

		// Parse html attribs
		elm = headerFragment.getAll('html')[0];
		if (elm) {
			data.langcode = getAttr(elm, 'lang') || getAttr(elm, 'xml:lang');
		}

		// Parse stylesheets
		data.stylesheets = [];
		tinymce.each(headerFragment.getAll('link'), function(link) {
			if (link.attr('rel') == 'stylesheet') {
				data.stylesheets.push(link.attr('href'));
			}
		});

		// Parse body parts
		elm = headerFragment.getAll('body')[0];
		if (elm) {
			data.langdir = getAttr(elm, 'dir');
			data.style = getAttr(elm, 'style');
			data.visited_color = getAttr(elm, 'vlink');
			data.link_color = getAttr(elm, 'link');
			data.active_color = getAttr(elm, 'alink');
		}
		console.log(data);
		return data;
	}

	function dataToHtml(data) {
		var headerFragment, headElement, html, elm, value, dom = editor.dom;

		function setAttr(elm, name, value) {
			elm.attr(name, value ? value : undefined);
		}

		function addHeadNode(node) {
			if (headElement.firstChild) {
				headElement.insert(node, headElement.firstChild);
			} else {
				headElement.append(node);
			}
		}

		headerFragment = parseHeader();
		headElement = headerFragment.getAll('head')[0];
		if (!headElement) {
			elm = headerFragment.getAll('html')[0];
			headElement = new Node('head', 1);

			if (elm.firstChild) {
				elm.insert(headElement, elm.firstChild, true);
			} else {
				elm.append(headElement);
			}
		}

		// Add/update/remove XML-PI
		elm = headerFragment.firstChild;
		if (data.xml_pi) {
			value = 'version="1.0"';

			if (data.docencoding) {
				value += ' encoding="' + data.docencoding + '"';
			}

			if (elm.type != 7) {
				elm = new Node('xml', 7);
				headerFragment.insert(elm, headerFragment.firstChild, true);
			}

			elm.value = value;
		} else if (elm && elm.type == 7) {
			elm.remove();
		}

		// Add/update/remove doctype
		elm = headerFragment.getAll('#doctype')[0];
		if (data.doctype) {
			if (!elm) {
				elm = new Node('#doctype', 10);

				if (data.xml_pi) {
					headerFragment.insert(elm, headerFragment.firstChild);
				} else {
					addHeadNode(elm);
				}
			}

			elm.value = data.doctype.substring(9, data.doctype.length - 1);
		} else if (elm) {
			elm.remove();
		}

		// Add meta encoding
		elm = null;
		each(headerFragment.getAll('meta'), function(meta) {
			if (meta.attr('http-equiv') == 'Content-Type') {
				elm = meta;
			}
		});

		if (data.docencoding) {
			if (!elm) {
				elm = new Node('meta', 1);
				elm.attr('http-equiv', 'Content-Type');
				elm.shortEnded = true;
				addHeadNode(elm);
			}

			elm.attr('content', 'text/html; charset=' + data.docencoding);
		} else if (elm) {
			elm.remove();
		}

		// Add/update/remove title
		elm = headerFragment.getAll('title')[0];
		if (data.title) {
			if (!elm) {
				elm = new Node('title', 1);
				addHeadNode(elm);
			} else {
				elm.empty();
			}

			elm.append(new Node('#text', 3)).value = data.title;
		} else if (elm) {
			elm.remove();
		}

		// Add/update/remove meta
		each('keywords,description,author,copyright,robots'.split(','), function(name) {
			var nodes = headerFragment.getAll('meta'), i, meta, value = data[name];

			for (i = 0; i < nodes.length; i++) {
				meta = nodes[i];

				if (meta.attr('name') == name) {
					if (value) {
						meta.attr('content', value);
					} else {
						meta.remove();
					}

					return;
				}
			}

			if (value) {
				elm = new Node('meta', 1);
				elm.attr('name', name);
				elm.attr('content', value);
				elm.shortEnded = true;

				addHeadNode(elm);
			}
		});

		var currentStyleSheetsMap = {};
		tinymce.each(headerFragment.getAll('link'), function(stylesheet) {
			if (stylesheet.attr('rel') == 'stylesheet') {
				currentStyleSheetsMap[stylesheet.attr('href')] = stylesheet;
			}
		});

		// Add new
		tinymce.each(data.stylesheets, function(stylesheet) {
			if (!currentStyleSheetsMap[stylesheet]) {
				elm = new Node('link', 1);
				elm.attr({
					rel: 'stylesheet',
					text: 'text/css',
					href: stylesheet
				});
				elm.shortEnded = true;
				addHeadNode(elm);
			}

			delete currentStyleSheetsMap[stylesheet];
		});

		// Delete old
		tinymce.each(currentStyleSheetsMap, function(stylesheet) {
			stylesheet.remove();
		});

		// Update body attributes
		elm = headerFragment.getAll('body')[0];
		if (elm) {
			setAttr(elm, 'dir', data.langdir);
			setAttr(elm, 'style', data.style);
			setAttr(elm, 'vlink', data.visited_color);
			setAttr(elm, 'link', data.link_color);
			setAttr(elm, 'alink', data.active_color);

			// Update iframe body as well
			dom.setAttribs(editor.getBody(), {
				style: data.style,
				dir: data.dir,
				vLink: data.visited_color,
				link: data.link_color,
				aLink: data.active_color
			});
		}

		// Set html attributes
		elm = headerFragment.getAll('html')[0];
		if (elm) {
			setAttr(elm, 'lang', data.langcode);
			setAttr(elm, 'xml:lang', data.langcode);
		}

		// No need for a head element
		if (!headElement.firstChild) {
			headElement.remove();
		}

		// Serialize header fragment and crop away body part
		html = new tinymce.html.Serializer({
			validate: false,
			indent: true,
			apply_source_formatting: true,
			indent_before: 'head,html,body,meta,title,script,link,style',
			indent_after: 'head,html,body,meta,title,script,link,style'
		}).serialize(headerFragment);

		head = html.substring(0, html.indexOf('</body>'));
	}

	function parseHeader() {
		// Parse the contents with a DOM parser
		return new tinymce.html.DomParser({
			validate: false,
			root_name: '#document'
		}).parse(head);
	}

	function setContent(evt) {
		var startPos, endPos, content = evt.content, headerFragment, styles = '', dom = editor.dom, elm;

		if (evt.selection) {
			return;
		}

		function low(s) {
			return s.replace(/<\/?[A-Z]+/g, function(a) {
				return a.toLowerCase();
			});
		}

		// Ignore raw updated if we already have a head, this will fix issues with undo/redo keeping the head/foot separate
		if (evt.format == 'raw' && head) {
			return;
		}

		if (evt.source_view && editor.getParam('fulldocument_hide_in_source_view')) {
			return;
		}

		// Fixed so new document/setContent('') doesn't remove existing header/footer except when it's in source code view
		if (content.length === 0 && !evt.source_view) {
			content = tinymce.trim(head) + '\n' + tinymce.trim(content) + '\n' + tinymce.trim(foot);
		}

		// Parse out head, body and footer
		content = content.replace(/<(\/?)BODY/gi, '<$1body');
		startPos = content.indexOf('<body');

		if (startPos != -1) {
			startPos = content.indexOf('>', startPos);
			head = low(content.substring(0, startPos + 1));

			endPos = content.indexOf('</body', startPos);
			if (endPos == -1) {
				endPos = content.length;
			}

			evt.content = content.substring(startPos + 1, endPos);
			foot = low(content.substring(endPos));
		} else {
			head = getDefaultHeader();
			foot = '\n</body>\n</html>';
		}

		// Parse header and update iframe
		headerFragment = parseHeader();
		each(headerFragment.getAll('style'), function(node) {
			if (node.firstChild) {
				styles += node.firstChild.value;
			}
		});

		elm = headerFragment.getAll('body')[0];
		if (elm) {
			dom.setAttribs(editor.getBody(), {
				style: elm.attr('style') || '',
				dir: elm.attr('dir') || '',
				vLink: elm.attr('vlink') || '',
				link: elm.attr('link') || '',
				aLink: elm.attr('alink') || ''
			});
		}

		dom.remove('fulldocument_styles');

		var headElm = editor.getDoc().getElementsByTagName('head')[0];

		if (styles) {
			dom.add(headElm, 'style', {
				id: 'fulldocument_styles'
			}, styles);

			// Needed for IE 6/7
			elm = dom.get('fulldocument_styles');
			if (elm.styleSheet) {
				elm.styleSheet.cssText = styles;
			}
		}

		var currentStyleSheetsMap = {};
		tinymce.each(headElm.getElementsByTagName('link'), function(stylesheet) {
			if (stylesheet.rel == 'stylesheet' && stylesheet.getAttribute('data-mce-fulldocument')) {
				currentStyleSheetsMap[stylesheet.href] = stylesheet;
			}
		});

		// Add new
		tinymce.each(headerFragment.getAll('link'), function(stylesheet) {
			var href = stylesheet.attr('href');

			if (!currentStyleSheetsMap[href] && stylesheet.attr('rel') == 'stylesheet') {
				dom.add(headElm, 'link', {
					rel: 'stylesheet',
					text: 'text/css',
					href: href,
					'data-mce-fulldocument': '1'
				});
			}

			delete currentStyleSheetsMap[href];
		});

		// Delete old
		tinymce.each(currentStyleSheetsMap, function(stylesheet) {
			stylesheet.parentNode.removeChild(stylesheet);
		});
	}

	/**
	 * @return String
	 * String that begins by the doctype and finishing by the openning body tag,
	 * including headers defined with the fulldocument popup or styles defined in html source
	 */
	function getDefaultHeader() {
		var header = '', value, styles = '';

		if (editor.getParam('fulldocument_default_xml_pi')) {
			header += '<?xml version="1.0" encoding="' + editor.getParam('fulldocument_default_encoding', 'ISO-8859-1') + '" ?>\n';
		}

		header += editor.getParam('fulldocument_default_doctype', '<!DOCTYPE html>');
		header += '\n<html>\n<head>\n';

		if ((value = editor.getParam('fulldocument_default_title'))) {
			header += '<title>' + value + '</title>\n';
		}

		if ((value = editor.getParam('fulldocument_default_encoding'))) {
			header += '<meta http-equiv="Content-Type" content="text/html; charset=' + value + '" />\n';
		}

		if ((value = editor.getParam('fulldocument_default_font_family'))) {
			styles += 'font-family: ' + value + ';';
		}

		if ((value = editor.getParam('fulldocument_default_font_size'))) {
			styles += 'font-size: ' + value + ';';
		}

		if ((value = editor.getParam('fulldocument_default_text_color'))) {
			styles += 'color: ' + value + ';';
		}

		header += '</head>\n<body' + (styles ? ' style="' + styles + '"' : '') + '>\n';

		return header;
	}

	/**
	 * @return void
	 * on getContent event handler
	 * if event and configuration permit, change the evt.content (body content only) by concatenation of
	 * - the doctype
	 * - the opening html tag
	 * - a calculated header,
	 * - the body openning tag
	 * - the default body content (original evt.content)
	 * - closing body and html tags
	 */
	function getContent(evt) {
		if (!evt.selection && (!evt.source_view || !editor.getParam('fulldocument_hide_in_source_view'))) {
			evt.content = tinymce.trim(head) + '\n' + tinymce.trim(evt.content) + '\n' + tinymce.trim(foot);
		}
	}

	editor.addCommand('mceFullDocumentProperties', showDialog);

	editor.addButton('fulldocument', {
		title: 'Document properties',
		cmd: 'mceFullDocumentProperties'
	});

	if (editor.getParam('fulldocument_enable_menu_item',true)) {
		editor.addMenuItem('fulldocument', {
			text: 'Document properties',
			cmd: 'mceFullDocumentProperties',
			context: 'file'
		});
	}


	editor.on('BeforeSetContent', setContent);
	// editor.on('BeforeSetContent', getContent);  // do not uncomment, this cause issues. Line To be removed soon.
	editor.on('GetContent', getContent);


	// editor.on('BeforeSetContent', function(evt){
	// 	console.info('before set content');
	// 	console.log(evt.content);
	// });
	// editor.on('GetContent', function(evt){
	// 	console.info('get content');
	// 	console.log(evt.content);
	// });
	// editor.on('SetContent', function(evt){
	// 	console.info('set content');
	// 	console.log(evt.content);
	// });
});
