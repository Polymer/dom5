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

declare module 'parse5' {
  interface TreeAdapter {

  }
  export class Parser {
    constructor(treeAdapter?: TreeAdapter, options?: ParserOptions);
    parse(html: string): ASTNode;
    parseFragment(html: string): ASTNode;
  }
  export class Serializer {
    constructor();
    serialize(node: ASTNode): string;
  }
  export const TreeAdapters: {
    default: TreeAdapter;
  }
}

import * as cloneObject from 'clone';
import * as parse5 from 'parse5';

function getAttributeIndex(element, name) {
  if (!element.attrs) {
    return -1;
  }
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
export function hasAttribute(element, name) {
  return getAttributeIndex(element, name) !== -1;
}

/**
 * @returns {string|null} The string value of attribute `name`, or `null`.
 */
export function getAttribute(element, name) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    return element.attrs[i].value;
  }
  return null;
}

export function setAttribute(element, name, value) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs[i].value = value;
  } else {
    element.attrs.push({name: name, value: value});
  }
}

export function removeAttribute(element, name) {
  var i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs.splice(i, 1);
  }
}

function hasTagName(name) {
  var n = name.toLowerCase();
  return function(node) {
    if (!node.tagName) {
      return false;
    }
    return node.tagName.toLowerCase() === n;
  };
}

/**
 * Returns true if `regex.match(tagName)` finds a match.
 *
 * This will use the lowercased tagName for comparison.
 *
 * @param  {RegExp} regex
 * @return {Boolean}
 */
function hasMatchingTagName(regex) {
  return function(node) {
    if (!node.tagName) {
      return false;
    }
    return regex.test(node.tagName.toLowerCase());
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

function collapseTextRange(parent, start, end) {
  var text = '';
  for (var i = start; i <= end; i++) {
    text += getTextContent(parent.childNodes[i]);
  }
  parent.childNodes.splice(start, (end - start) + 1);
  if (text) {
    var tn = newTextNode(text);
    tn.parentNode = parent;
    parent.childNodes.splice(start, 0, tn);
  }
}

/**
 * Normalize the text inside an element
 *
 * Equivalent to `element.normalize()` in the browser
 * See https://developer.mozilla.org/en-US/docs/Web/API/Node/normalize
 */
export function normalize(node) {
  if (!(isElement(node) || isDocument(node) || isDocumentFragment(node))) {
    return;
  }
  var textRangeStart = -1;
  for (var i = node.childNodes.length - 1, n; i >= 0; i--) {
    n = node.childNodes[i];
    if (isTextNode(n)) {
      if (textRangeStart == -1) {
        textRangeStart = i;
      }
      if (i === 0) {
        // collapse leading text nodes
        collapseTextRange(node, 0, textRangeStart);
      }
    } else {
      // recurse
      normalize(n);
      // collapse the range after this node
      if (textRangeStart > -1) {
        collapseTextRange(node, i + 1, textRangeStart);
        textRangeStart = -1;
      }
    }
  }
}

/**
 * Return the text value of a node or element
 *
 * Equivalent to `node.textContent` in the browser
 */
export function getTextContent(node) {
  if (isCommentNode(node)) {
    return node.data;
  }
  if (isTextNode(node)) {
    return node.value;
  }
  var subtree = nodeWalkAll(node, isTextNode);
  return subtree.map(getTextContent).join('');
}

/**
 * Set the text value of a node or element
 *
 * Equivalent to `node.textContent = value` in the browser
 */
export function setTextContent(node, value) {
  if (isCommentNode(node)) {
    node.data = value;
  } else if (isTextNode(node)) {
    node.value = value;
  } else {
    var tn = newTextNode(value);
    tn.parentNode = node;
    node.childNodes = [tn];
  }
}

/**
 * Match the text inside an element, textnode, or comment
 *
 * Note: nodeWalkAll with hasTextValue may return an textnode and its parent if
 * the textnode is the only child in that parent.
 */
function hasTextValue(value) {
  return function(node) {
    return getTextContent(node) === value;
  };
}

export type Predicate = (node: parse5.ASTNode) => boolean;

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
function AND(...Predicate):Predicate;
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

/**
 * Returns a predicate that matches any node with a parent matching `predicateFn`.
 */
function parentMatches(predicateFn) {
  return function(node) {
    var parent = node.parentNode;
    while(parent !== undefined) {
      if (predicateFn(parent)) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
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

export function isDocument(node) {
  return node.nodeName === '#document';
}

export function isDocumentFragment(node) {
  return node.nodeName === '#document-fragment';
}

export function isElement(node) {
  return node.nodeName === node.tagName;
}

export function isTextNode(node) {
  return node.nodeName === '#text';
}

export function isCommentNode(node) {
  return node.nodeName === '#comment';
}

/**
 * Applies `mapfn` to `node` and the tree below `node`, returning a flattened
 * list of results.
 * @return {Array}
 */
export function treeMap(node, mapfn) {
  var results = [];
  nodeWalk(node, function(node){
    results = results.concat(mapfn(node));
    return false;
  });
  return results;
}

/**
 * Walk the tree down from `node`, applying the `predicate` function.
 * Return the first node that matches the given predicate.
 *
 * @returns {Node} `null` if no node matches, parse5 node object if a node
 * matches
 */
export function nodeWalk(node, predicate) {
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
export function nodeWalkAll(node, predicate, matches?: parse5.ASTNode[]) {
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

function _reverseNodeWalkAll(node, predicate, matches) {
  if (!matches) {
    matches = [];
  }
  if (node.childNodes) {
    for (var i = node.childNodes.length - 1; i >= 0; i--) {
      nodeWalkAll(node.childNodes[i], predicate, matches);
    }
  }
  if (predicate(node)) {
    matches.push(node);
  }
  return matches;
}

/**
 * Equivalent to `nodeWalk`, but only returns nodes that are either
 * ancestors or earlier cousins/siblings in the document.
 *
 * Nodes are searched in reverse document order, starting from the sibling
 * prior to `node`.
 */
export function nodeWalkPrior(node, predicate) {
  // Search our earlier siblings and their descendents.
  var parent = node.parentNode;
  if (parent) {
    var idx = parent.childNodes.indexOf(node);
    var siblings = parent.childNodes.slice(0, idx);
    for (var i = siblings.length-1; i >= 0; i--) {
      var sibling = siblings[i];
      if (predicate(sibling)) {
        return sibling;
      }
      var found = nodeWalkPrior(sibling, predicate);
    }
    if (predicate(parent)) {
      return parent;
    }
    return nodeWalkPrior(parent, predicate);
  }
  return undefined;
}

/**
 * Equivalent to `nodeWalkAll`, but only returns nodes that are either
 * ancestors or earlier cousins/siblings in the document.
 *
 * Nodes are returned in reverse document order, starting from `node`.
 */
export function nodeWalkAllPrior(node, predicate, matches) {
  if (!matches) {
    matches = [];
  }
  if (predicate(node)) {
    matches.push(node);
  }
  // Search our earlier siblings and their descendents.
  var parent = node.parentNode;
  if (parent) {
    var idx = parent.childNodes.indexOf(node);
    var siblings = parent.childNodes.slice(0, idx);
    for (var i = siblings.length-1; i >= 0; i--) {
      _reverseNodeWalkAll(siblings[i], predicate, matches);
    }
    nodeWalkAllPrior(parent, predicate, matches);
  }
  return matches;
}

/**
 * Equivalent to `nodeWalk`, but only matches elements
 *
 * @returns {Element}
 */
export function query(node, predicate) {
  var elementPredicate = AND(isElement, predicate);
  return nodeWalk(node, elementPredicate);
}

/**
 * Equivalent to `nodeWalkAll`, but only matches elements
 *
 * @return {Array[Element]}
 */
export function queryAll(node, predicate, matches) {
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

function newDocumentFragment() {
  return {
    nodeName: '#document-fragment',
    childNodes: [],
    parentNode: null,
    quirksMode: false,
  };
}

export function cloneNode(node) {
  // parent is a backreference, and we don't want to clone the whole tree, so
  // make it null before cloning.
  var parent = node.parentNode;
  node.parentNode = null;
  var clone = cloneObject(node);
  node.parentNode = parent;
  return clone;
}

/**
 * Inserts `newNode` into `parent` at `index`, optionally replaceing the
 * current node at `index`. If `newNode` is a DocumentFragment, its childNodes
 * are inserted and removed from the fragment.
 */
function insertNode(parent, index, newNode, replace?: boolean) {
  var newNodes = [];
  var removedNode = replace ? parent.childNodes[index] : null;

  if (newNode) {
    if (isDocumentFragment(newNode)) {
      newNodes = newNode.childNodes;
      newNode.childNodes = [];
    } else {
      newNodes = [newNode];
      remove(newNode);
    }
  }

  if (replace) {
    removedNode = parent.childNodes[index];
  }

  Array.prototype.splice.apply(parent.childNodes,
      [index, replace ? 1 : 0].concat(newNodes));

  newNodes.forEach(function(n) {
    n.parentNode = parent;
  });

  if (removedNode) {
    removedNode.parentNode = null;
  }
}

export function replace(oldNode, newNode) {
  var parent = oldNode.parentNode;
  var index = parent.childNodes.indexOf(oldNode);
  insertNode(parent, index, newNode, true);
}

export function remove(node) {
  var parent = node.parentNode;
  if (parent) {
    var idx = parent.childNodes.indexOf(node);
    parent.childNodes.splice(idx, 1);
  }
  node.parentNode = null;
}

export function insertBefore(parent, oldNode, newNode) {
  var index = parent.childNodes.indexOf(oldNode);
  insertNode(parent, index, newNode);
}

export function append(parent, newNode) {
  insertNode(parent, parent.childNodes.length, newNode);
}

export function parse(text, options) {
  var parser = new parse5.Parser(parse5.TreeAdapters.default, options);
  return parser.parse(text);
}

export function parseFragment(text) {
  var parser = new parse5.Parser();
  return parser.parseFragment(text);
}

export function serialize(ast) {
  var serializer = new parse5.Serializer();
  return serializer.serialize(ast);
}

export const predicates = {
    hasClass: hasClass,
    hasAttr: hasAttr,
    hasAttrValue: hasAttrValue,
    hasMatchingTagName: hasMatchingTagName,
    hasTagName: hasTagName,
    hasTextValue: hasTextValue,
    AND: AND,
    OR: OR,
    NOT: NOT,
    parentMatches: parentMatches,
  };
export const   constructors = {
    text: newTextNode,
    comment: newCommentNode,
    element: newElement,
    fragment: newDocumentFragment,
  };

