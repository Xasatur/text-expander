# text-expander

text-expander is a Chrome extension that turns short triggers into longer
snippets, helping you type repetitive text quickly in any webpage. It listens
for defined snippet keywords and replaces them with their full content in both
standard text inputs and ServiceNow's special fields.

## Features

- Expand custom snippet keywords into full text
- Works with ServiceNow form fields as well as regular inputs
- Dynamic variables allow user input at expansion time
- Manage your snippets through the extension popup and options page

## Usage

1. Load the extension in Chrome via **Extensions > Load unpacked** and select
   this project folder.
2. Open the popup or options page to add or edit snippets. Give each snippet a
   short trigger (for example `_greet`) and the text it should expand to.
3. Type the trigger into a text field. The extension replaces it with your
   configured snippet.
4. If the snippet contains variables, a popup will ask you to provide values
   before the text is inserted.

## Variable Placeholders

Snippets can include dynamic values. Use either `{{name}}` or `(name)` in a
snippet to mark a variable. When the snippet is triggered, a popup will prompt
for the value of each variable before inserting the text.
=======
Text expander for work

## Variable Placeholders

Snippets can include dynamic values. Use either `{{name}}` or `(name)` in a snippet to mark a variable. When the snippet is triggered, a popup will ask for the value of each variable before inserting the text.
