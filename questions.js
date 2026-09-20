module.exports = [
  {
    "question": "In a tree, what is the root?",
    "options": [
      "A node with no children",
      "The topmost node with no parent",
      "The deepest leaf node",
      "Any node with two children"
    ],
    "answer": 1
  },
  {
    "question": "A node in a tree with no children is called a:",
    "options": [
      "Root",
      "Internal node",
      "Leaf",
      "Sibling"
    ],
    "answer": 2
  },
  {
    "question": "Which representation stores a binary tree using an array with the root at index 0 and the left child of index i at 2i + 1?",
    "options": [
      "Parenthesis representation",
      "Linked representation",
      "Child-sibling representation",
      "Sequential representation"
    ],
    "answer": 3
  },
  {
    "question": "What is the maximum number of nodes in a binary tree of height h, measured in edges?",
    "options": [
      "2h",
      "h + 1",
      "2^h",
      "2^(h + 1) - 1"
    ],
    "answer": 3
  },
  {
    "question": "Which condition defines a full binary tree?",
    "options": [
      "Every node has exactly one child",
      "Every node has either zero or two children",
      "All leaves are at different levels",
      "The tree is always complete"
    ],
    "answer": 1
  },
  {
    "question": "In a binary search tree, where are keys smaller than a node's key placed?",
    "options": [
      "In its right subtree",
      "In its left subtree",
      "At the root only",
      "In a separate tree"
    ],
    "answer": 1
  },
  {
    "question": "What is the inorder traversal of the BST formed by inserting 50, 30, 70, 20, 40?",
    "options": [
      "50, 30, 20, 40, 70",
      "20, 30, 40, 50, 70",
      "20, 40, 30, 70, 50",
      "70, 50, 40, 30, 20"
    ],
    "answer": 1
  },
  {
    "question": "What is the preorder traversal of the BST formed by inserting 40, 20, 60, 10, 30?",
    "options": [
      "10, 20, 30, 40, 60",
      "40, 20, 10, 30, 60",
      "10, 30, 20, 60, 40",
      "40, 60, 20, 30, 10"
    ],
    "answer": 1
  },
  {
    "question": "What is the postorder traversal of the binary tree with root 1, left child 2, right child 3, and 2's children 4 and 5?",
    "options": [
      "1, 2, 4, 5, 3",
      "4, 5, 2, 3, 1",
      "1, 3, 2, 5, 4",
      "4, 2, 5, 1, 3"
    ],
    "answer": 1
  },
  {
    "question": "Which traversal visits a node before both of its subtrees?",
    "options": [
      "Inorder",
      "Postorder",
      "Preorder",
      "Level order"
    ],
    "answer": 2
  },
  {
    "question": "For a BST with distinct keys, which traversal always produces keys in ascending order?",
    "options": [
      "Preorder",
      "Postorder",
      "Inorder",
      "Reverse level order"
    ],
    "answer": 2
  },
  {
    "question": "What is the worst-case search time in an unbalanced BST containing n nodes?",
    "options": [
      "Constant time: O(1)",
      "Logarithmic time: O(log n)",
      "Linear time: O(n)",
      "Linearithmic time: O(n log n)"
    ],
    "answer": 2
  },
  {
    "question": "When deleting a BST node with two children, which replacement is commonly used?",
    "options": [
      "Any leaf in the tree",
      "Its inorder successor or inorder predecessor",
      "The root of the tree only",
      "The node's left child without adjustment"
    ],
    "answer": 1
  },
  {
    "question": "In an AVL tree, the balance factor of a node is usually calculated as:",
    "options": [
      "Height(right) - height(left)",
      "Number of children minus height",
      "Height(left) - height(right)",
      "Total nodes in left subtree"
    ],
    "answer": 2
  },
  {
    "question": "Which balance factors are allowed for every node in a valid AVL tree?",
    "options": [
      "Only 0",
      "-1, 0, or 1",
      "-2, -1, 0, 1, or 2",
      "Any integer"
    ],
    "answer": 1
  },
  {
    "question": "Inserting 30, 20, and 10 into an AVL tree creates which imbalance at 30?",
    "options": [
      "RR",
      "RL",
      "LL",
      "LR"
    ],
    "answer": 2
  },
  {
    "question": "Which rotation fixes the LL imbalance caused by inserting 30, 20, 10?",
    "options": [
      "Left rotation at 30",
      "Right rotation at 30",
      "Left-right rotation at 20",
      "Right-left rotation at 20"
    ],
    "answer": 1
  },
  {
    "question": "Inserting 10, 20, and 30 into an AVL tree creates which imbalance at 10?",
    "options": [
      "LL",
      "LR",
      "RL",
      "RR"
    ],
    "answer": 3
  },
  {
    "question": "Which rotation fixes an RR imbalance in an AVL tree?",
    "options": [
      "Single left rotation",
      "Single right rotation",
      "Left-right double rotation",
      "Right-left double rotation"
    ],
    "answer": 0
  },
  {
    "question": "Inserting 30, 10, and 20 produces which AVL case at 30?",
    "options": [
      "LL",
      "RR",
      "LR",
      "RL"
    ],
    "answer": 2
  },
  {
    "question": "How is an LR imbalance corrected in an AVL tree?",
    "options": [
      "Right rotation only at the unbalanced node",
      "Left rotation on the left child, then right rotation on the unbalanced node",
      "Right rotation on the right child, then left rotation on the unbalanced node",
      "Left rotation only at the unbalanced node"
    ],
    "answer": 1
  },
  {
    "question": "An AVL node has left-subtree height 3 and right-subtree height 1. What is its balance factor using left minus right?",
    "options": [
      "-2",
      "-1",
      "1",
      "2"
    ],
    "answer": 3
  },
  {
    "question": "After deleting a node from an AVL tree, why may rotations be needed while moving toward the root?",
    "options": [
      "Deletion can change ancestor heights and violate balance",
      "Deletion always changes every key",
      "AVL trees cannot contain leaves",
      "Rotations are required after every search"
    ],
    "answer": 0
  },
  {
    "question": "What is the worst-case time complexity of search, insertion, and deletion in an AVL tree with n nodes?",
    "options": [
      "Constant time",
      "Logarithmic time",
      "Linear time",
      "Linearithmic time"
    ],
    "answer": 1
  },
  {
    "question": "What happens during a splay-tree access operation?",
    "options": [
      "The accessed node is moved toward the root by rotations",
      "The accessed node is permanently deleted",
      "Every node is sorted by inorder traversal",
      "The tree is converted into a complete tree"
    ],
    "answer": 0
  },
  {
    "question": "Which statement describes the amortized complexity of splay-tree search?",
    "options": [
      "O(1) per operation in all cases",
      "O(log n) per operation amortized",
      "O(n^2) amortized",
      "O(n log n) per operation amortized"
    ],
    "answer": 1
  },
  {
    "question": "What is a key property of a B-tree used for indexing?",
    "options": [
      "All leaves are at the same level",
      "Each node has exactly two children",
      "Keys are never sorted within a node",
      "Only the root may contain keys"
    ],
    "answer": 0
  },
  {
    "question": "When a B-tree node overflows during insertion, what commonly occurs?",
    "options": [
      "The node is ignored",
      "The node is split and a separator key moves upward",
      "The entire tree is deleted",
      "All keys are moved to the root"
    ],
    "answer": 1
  },
  {
    "question": "Which property must a binary min-heap satisfy?",
    "options": [
      "Every parent is greater than or equal to its children",
      "Every parent is less than or equal to its children",
      "The tree must be a binary search tree",
      "All leaves must have the same key"
    ],
    "answer": 1
  },
  {
    "question": "Which structure is normally used to implement a binary heap?",
    "options": [
      "A complete binary tree",
      "A full ternary tree",
      "An arbitrary graph",
      "A sorted linked list"
    ],
    "answer": 0
  },
  {
    "question": "In a max-heap, which element is stored at the root?",
    "options": [
      "The smallest element",
      "The median element",
      "The largest element",
      "The most recently inserted element"
    ],
    "answer": 2
  },
  {
    "question": "What is the time complexity of inserting one element into a binary heap?",
    "options": [
      "Constant time in the worst case",
      "Logarithmic time in the worst case",
      "Linear time in the worst case",
      "Linearithmic time in the worst case"
    ],
    "answer": 1
  },
  {
    "question": "What is the time complexity of building a heap from n arbitrary elements using bottom-up heapify?",
    "options": [
      "O(log n)",
      "O(n)",
      "O(n log n)",
      "O(n^2)"
    ],
    "answer": 1
  },
  {
    "question": "Which operation is the usual binary-heap implementation of removing the highest-priority item?",
    "options": [
      "Remove an arbitrary leaf without repair",
      "Replace the root with the last element and heapify down",
      "Rotate the root once and stop",
      "Perform an inorder traversal and remove the middle item"
    ],
    "answer": 1
  },
  {
    "question": "Which application is most directly suited to a priority queue implemented with a binary heap?",
    "options": [
      "Selecting the next task with the highest priority",
      "Storing a fixed two-dimensional table",
      "Reversing a string character by character",
      "Checking whether a tree is binary"
    ],
    "answer": 0
  },
  {
    "type": "scrambled",
    "question": "Which tree term is represented by these scrambled letters: T O O R?",
    "scrambled": "T O O R",
    "answer": "ROOT"
  },
  {
    "type": "scrambled",
    "question": "Which tree traversal is represented by these scrambled letters: R O D E R P R E?",
    "scrambled": "R O D E R P R E",
    "answer": "PREORDER"
  },
  {
    "type": "scrambled",
    "question": "Which balanced tree is represented by these scrambled letters: L V A?",
    "scrambled": "L V A",
    "answer": "AVL"
  },
  {
    "type": "scrambled",
    "question": "Which heap operation is represented by these scrambled letters: P A H E F I Y?",
    "scrambled": "P A H E F I Y",
    "answer": "HEAPIFY"
  },
  {
    "type": "scrambled",
    "question": "Which multiway search tree is represented by these scrambled letters: E E R T - B?",
    "scrambled": "E E R T - B",
    "answer": "B-TREE"
  }
];
