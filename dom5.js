/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// jshint node: true
'use strict';

function getAttributeIndex(element, name) {
  var n = name.toLowerCase();
  for (var i = 0; i < element.attrs.length; i++) {
    if (element.attrs[i].name.toLowerCase() === n) {
      return i;
    }
  }
  return -1;
}

/**
 * @returns {boolean} `true` iff [element] has the attribute [name], `false`
 *   otherwise.
 */
function hasAttribute(element, name) {
  return getAttributeIndex(element, name) !== -1;
}

/**
 * @returns {string|null} The string value of attribute `name`, or `null`.
 */
function getAttribute(element, name) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    return element.attrs[i].value;
  }
  return null;
}

function setAttribute(element, name, value) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs[i].value = value;
  } else {
    element.attrs.push({name: name, value: value});
  }
}

function removeAttribute(element, name) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs.splice(i, 1);
  }
}

function getTextContent(element) {
  var content = '';
  for (var child of element.childNodes) {
    if (child.nodeName === '#text') {
      content += child.value;
    } else {
      content += getTextContent(child);
    }
  }
  return content;
}

function setTextContent(element, value) {
  console.assert(typeof value === 'string');
  element.childNodes = [
    {nodeName: '#text', value: value},
  ];
}

function hasTagName(name) {
  var n = name.toLowerCase();
  return function(node) {
    return node.tagName.toLowerCase() === n;
  };
}

function hasClass(name) {
  return function(node) {
    var attr = getAttribute(node, 'class');
    if (!attr) {
      return false;
    }
    return attr.split(' ').indexOf(name) > -1;
  };
}

/**
 * Normalize the text inside an element
 *
 * Equivalent to `element.textContent` in the browser
 */
function normalizeTextContent(node) {
  var text = '';
  if (isElement(node)) {
    for (var i = 0, cn; i < node.childNodes.length; i++) {
      cn = node.childNodes[i];
      if (!isTextNode(cn)) {
        continue;
      }
      text += cn.value;
    }
  }
  return text;
}

/**
 * Match the text inside an element, textnode, or comment
 *
 * Note: nodeWalkAll with hasTextValue may return an textnode and its parent if
 * the textnode is the only child in that parent.
 */
function hasTextValue(value) {
  return function(node) {
    if (isElement(node)) {
      return normalizeTextContent(node) === value;
    } else if (isTextNode(node)) {
      return node.value === value;
    } else if (isCommentNode(node)) {
      return node.data === value;
    }
    return false;
  };
}

/**
 * OR an array of predicates
 */
function OR(/* ...rules */) {
  var rules = new Array(arguments.length);
  for (var i = 0; i < arguments.length; i++) {
    rules[i] = arguments[i];
  }
  return function(node) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i](node)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * AND an array of predicates
 */
function AND(/* ...rules */) {
  var rules = new Array(arguments.length);
  for (var i = 0; i < arguments.length; i++) {
    rules[i] = arguments[i];
  }
  return function(node) {
    for (var i = 0; i < rules.length; i++) {
      if (!rules[i](node)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * negate an individual predicate, or a group with AND or OR
 */
function NOT(predicateFn) {
  return function(node) {
    return !predicateFn(node);
  };
}

function hasAttr(attr) {
  return function(node) {
    return getAttributeIndex(node, attr) > -1;
  };
}

function hasAttrValue(attr, value) {
  return function(node) {
    return getAttribute(node, attr) === value;
  };
}

function isElement(node) {
  return node.nodeName === node.tagName;
}

function isTextNode(node) {
  return node.nodeName === '#text';
}

function isCommentNode(node) {
  return node.nodeName === '#comment';
}

/**
 * Walk the tree down from `node`, applying the `predicate` function.
 * Return the first node that matches the given predicate.
 *
 * @returns {Node} `null` if no node matches, parse5 node object if a node
 * matches
 */
function nodeWalk(node, predicate) {
  if (predicate(node)) {
    return node;
  }
  var match = null;
  if (node.childNodes) {
    for (var i = 0; i < node.childNodes.length; i++) {
      match = nodeWalk(node.childNodes[i], predicate);
      if (match) {
        break;
      }
    }
  }
  return match;
}

/**
 * Walk the tree down from `node`, applying the `predicate` function.
 * All nodes matching the predicate function from `node` to leaves will be
 * returned.
 *
 * @returns {Array[Node]}
 */
function nodeWalkAll(node, predicate, matches) {
  if (!matches) {
    matches = [];
  }
  if (predicate(node)) {
    matches.push(node);
  }
  if (node.childNodes) {
    for (var i = 0; i < node.childNodes.length; i++) {
      nodeWalkAll(node.childNodes[i], predicate, matches);
    }
  }
  return matches;
}

/**
 * Equivalent to `nodeWalk`, but only matches elements
 *
 * @returns {Element}
 */
function query(node, predicate) {
  var elementPredicate = AND(isElement, predicate);
  return nodeWalk(node, elementPredicate);
}

/**
 * Equivalent to `nodeWalkAll`, but only matches elements
 *
 * @return {Array[Element]}
 */
function queryAll(node, predicate, matches) {
  var elementPredicate = AND(isElement, predicate);
  return nodeWalkAll(node, elementPredicate, matches);
}

function newTextNode(value) {
  return {
    nodeName: '#text',
    value: value,
    parentNode: null
  };
}

function newCommentNode(comment) {
  return {
    nodeName: '#comment',
    data: comment,
    parentNode: null
  };
}

function newElement(tagName, namespace) {
  return {
    nodeName: tagName,
    tagName: tagName,
    childNodes: [],
    namespaceURI: namespace || 'http://www.w3.org/1999/xhtml',
    attrs: [],
    parentNode: null,
  };
}

var parse5 = require('parse5');
var parser = new parse5.Parser();
var serializer = new parse5.Serializer();

function parse(text) {
  return parser.parse(text);
}

function parseFragment(text) {
  return parser.parseFragment(text);
}

function serialize(ast) {
  return serializer.serialize(ast);
}

module.exports = {
  getAttribute: getAttribute,
  hasAttribute: hasAttribute,
  setAttribute: setAttribute,
  removeAttribute: removeAttribute,
  getTextContent: getTextContent,
  setTextContent: setTextContent,
  isElement: isElement,
  isTextNode: isTextNode,
  isCommentNode: isCommentNode,
  query: query,
  queryAll: queryAll,
  nodeWalk: nodeWalk,
  nodeWalkAll: nodeWalkAll,
  predicates: {
    hasClass: hasClass,
    hasAttr: hasAttr,
    hasAttrValue: hasAttrValue,
    hasTagName: hasTagName,
    hasTextValue: hasTextValue,
    AND: AND,
    OR: OR,
    NOT: NOT
  },
  constructors: {
    text: newTextNode,
    comment: newCommentNode,
    element: newElement
  },
  parse: parse,
  parseFragment: parseFragment,
  serialize: serialize
};
