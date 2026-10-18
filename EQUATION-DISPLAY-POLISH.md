# Equation display polish

- Removed the permanent border, blue background, padding, and rounded corners from inserted equations in the editor and student reading views.
- Equations now inherit surrounding text color and use normal inline math sizing by default.
- A subtle dashed outline appears only while hovering over an equation in the editor; student views remain undecorated.
- The equation element and `data-latex` source are preserved so existing insertion and source-retention behavior remains unchanged.

Validation note: CSS-only change; run the normal project build and test inline/display equations, save/reopen, and student preview before deployment.
