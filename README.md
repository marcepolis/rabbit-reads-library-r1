# rabbit reads

A library of books for the rabbit r1.

Each book in this repository is packaged as its own rabbit r1 creation, allowing you to read complete books on your device with support for:

* Chapter index
* Highlights
* Notes
* Bookmarks
* Light and dark mode
* Adjustable font size
* Adjustable font family
* Local reading progress

## repository structure

Each book folder contains all the files required to run that book as a rabbit r1 Creation.

The folders are named as [title] - [author] - [language]


## creating your own book

### step 1 — generate the book creation files

Go to:

https://marcepolis.github.io/ereader-v2-r1/

Upload your EPUB file and generate the rabbit reads version of the book.

The tool will:

* Process the EPUB
* Normalize formatting
* Generate the reader files
* Package everything as a rabbit r1 creation

### Step 2 — create a gitHub repository

Create a GitHub repository and upload the generated book files.

You can choose either approach:

#### option A — one book per creation

Create a separate creation for every book.

This is the recommended approach.

#### Option B — reuse the same creation

You can replace the book files inside an existing creation and publish a new version of the same Creation.

This is useful if you want to keep a single QR code and update the book over time.

### Step 3 — generate the installation qr code

Go to:

https://marcepolis.github.io/r1-creation-builder/


Use the Creation Builder to generate the installation QR code for your rabbit r1.

The QR code can then be scanned from the rabbit device to install the creation.


## public domain books

This repository is intended primarily for public domain books and personal works that you have permission to distribute.

Please make sure you have the legal right to distribute any content you publish.

You can use: https://www.gutenberg.org/

## contributing

Contributions on new books are welcome to create a library for rabbit r1!

You can:
* Add public domain books
* Improve metadata
* Report formatting issues
* Improve the reader experience

Fork this repository, add the folder with the book files, and PR (:

