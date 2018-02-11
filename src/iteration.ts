/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {ASTNode as Node, ASTNode, treeAdapters} from 'parse5';
export {ASTNode as Node} from 'parse5';

/**
 * Applies `mapfn` to `node` and the tree below `node`, yielding a flattened
 * list of results.
 */
export function*
    treeMap<U>(
        node: Node,
        mapfn: (node: Node) => Iterable<U>,
        getChildNodes?: GetChildNodes): IterableIterator<U> {
  for (const child of depthFirst(node, getChildNodes)) {
    yield* mapfn(child);
  };
}

export type GetChildNodes = ((node: Node) => Node[] | undefined);

export const defaultChildNodes = function defaultChildNodes(node: ASTNode) {
  return node.childNodes;
};

export const childNodesIncludeTemplate = function childNodesIncludeTemplate(
    node: ASTNode) {
  if (node.nodeName === 'template') {
    return treeAdapters.default.getTemplateContent(node).childNodes;
  }

  return node.childNodes;
};

/**
 * Iterates over the `node` and all of its children, recursively.
 *
 * Yields `node` first, yields emits each descendent in depth first order.
 */
export function*
    depthFirst(node: Node, getChildNodes: GetChildNodes = defaultChildNodes):
        IterableIterator<Node> {
  yield node;
  const childNodes = getChildNodes(node);
  if (childNodes === undefined) {
    return;
  }
  for (const child of childNodes) {
    yield* depthFirst(child, getChildNodes);
  }
}

export function*
    depthFirstReversed(
        node: Node, getChildNodes: GetChildNodes = defaultChildNodes):
        IterableIterator<Node> {
  const childNodes = getChildNodes(node);
  if (childNodes !== undefined) {
    for (const child of reversedView(childNodes)) {
      yield* depthFirstReversed(child, getChildNodes);
    }
  }
  yield node;
}

/**
 * Like `depthFirst`, but descends into the bodies of `<template>`s.
 */
export function depthFirstIncludingTemplates(node: Node) {
  return depthFirst(node, childNodesIncludeTemplate);
}

/**
 * Yields `node` and each of its ancestors leading up the tree.
 */
export function* ancestors(node: Node): IterableIterator<Node> {
  let currNode: Node|undefined = node;
  while (currNode !== undefined) {
    yield currNode;
    currNode = currNode.parentNode;
  }
}

/**
 * Yields each element that has the same parent as `node` but that
 * comes before it in the document.
 *
 * Nodes are yielded in reverse document order (i.e. starting with the one
 * closest to `node`)
 */
export function* previousSiblings(node: Node): IterableIterator<Node> {
  const parent = node.parentNode;
  if (parent === undefined) {
    return;
  }
  const siblings = parent.childNodes;
  if (siblings === undefined) {
    throw new Error(`Inconsistent parse5 tree: parent does not have children`);
  }
  const index = siblings.indexOf(node);
  if (index === -1) {
    throw new Error(
        `Inconsistent parse5 tree: parent does not know about child`);
  }
  yield* reversedView(siblings, index - 1);
}

/** Iterate arr in reverse, optionally starting at a given index. */
function* reversedView<U>(arr: U[], initialIndex = arr.length - 1) {
  for (let index = initialIndex; index >= 0; index--) {
    yield arr[index];
  }
}

// function _reverseNodeWalkAll(
//     node: Node,
//     predicate: Predicate,
//     matches: Node[],
//     getChildNodes: GetChildNodes = defaultChildNodes): Node[] {
//   if (!matches) {
//     matches = [];
//   }
//   const childNodes = getChildNodes(node);
//   if (childNodes) {
//     for (let i = childNodes.length - 1; i >= 0; i--) {
//       nodeWalkAll(childNodes[i], predicate, matches, getChildNodes);
//     }
//   }
//   if (predicate(node)) {
//     matches.push(node);
//   }
//   return matches;
// }

// /**
//  * Equivalent to `nodeWalk`, but only returns nodes that are either
//  * ancestors or earlier cousins/siblings in the document.
//  *
//  * Nodes are searched in reverse document order, starting from the sibling
//  * prior to `node`.
//  */
// export function nodeWalkPrior(node: Node, predicate: Predicate): Node|
//     undefined {
//   // Search our earlier siblings and their descendents.
//   const parent = node.parentNode;
//   if (parent && parent.childNodes) {
//     const idx = parent.childNodes.indexOf(node);
//     const siblings = parent.childNodes.slice(0, idx);
//     for (let i = siblings.length - 1; i >= 0; i--) {
//       const sibling = siblings[i];
//       if (predicate(sibling)) {
//         return sibling;
//       }
//       const found = nodeWalk(sibling, predicate);
//       if (found) {
//         return found;
//       }
//     }
//     if (predicate(parent)) {
//       return parent;
//     }
//     return nodeWalkPrior(parent, predicate);
//   }
//   return undefined;
// }

// /**
//  * Walk the tree up from the parent of `node`, to its grandparent and so on
//  to * the root of the tree.  Return the first ancestor that matches the given
//  * predicate.
//  */
// export function nodeWalkAncestors(node: Node, predicate: Predicate): Node|
//     undefined {
//   const parent = node.parentNode;
//   if (!parent) {
//     return undefined;
//   }
//   if (predicate(parent)) {
//     return parent;
//   }
//   return nodeWalkAncestors(parent, predicate);
// }

// /**
//  * Equivalent to `nodeWalkAll`, but only returns nodes that are either
//  * ancestors or earlier cousins/siblings in the document.
//  *
//  * Nodes are returned in reverse document order, starting from `node`.
//  */
// export function nodeWalkAllPrior(
//     node: Node, predicate: Predicate, matches?: Node[]): Node[] {
//   if (!matches) {
//     matches = [];
//   }
//   if (predicate(node)) {
//     matches.push(node);
//   }
//   // Search our earlier siblings and their descendents.
//   const parent = node.parentNode;
//   if (parent) {
//     const idx = parent.childNodes!.indexOf(node);
//     const siblings = parent.childNodes!.slice(0, idx);
//     for (let i = siblings.length - 1; i >= 0; i--) {
//       _reverseNodeWalkAll(siblings[i], predicate, matches);
//     }
//     nodeWalkAllPrior(parent, predicate, matches);
//   }
//   return matches;
// }

// /**
//  * Equivalent to `nodeWalk`, but only matches elements
//  */
// export function query(
//     node: Node,
//     predicate: Predicate,
//     getChildNodes: GetChildNodes = defaultChildNodes): Node|null {
//   const elementPredicate = p.AND(isElement, predicate);
//   return nodeWalk(node, elementPredicate, getChildNodes);
// }

// /**
//  * Equivalent to `nodeWalkAll`, but only matches elements
//  */
// export function queryAll(
//     node: Node,
//     predicate: Predicate,
//     matches?: Node[],
//     getChildNodes: GetChildNodes = defaultChildNodes): Node[] {
//   const elementPredicate = p.AND(isElement, predicate);
//   return nodeWalkAll(node, elementPredicate, matches, getChildNodes);
// }
