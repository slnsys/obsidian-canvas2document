import { normalizePath, Workspace, WorkspaceLeaf, TFile, App, Editor, MarkdownView, Notice, Plugin, FileSystemAdapter } from 'obsidian';
// import * as fs from 'fs';
import * as path from 'path';

export default class Canvas2DocumentPlugin extends Plugin {
	fsadapter: FileSystemAdapter;

	async onload() {
	
		// this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 } else {
			//TODO throw exception for fsadapter
			return
		 }

		this.addCommand({
			id: "run-conversion",
			name: "Convert canvas to a longform document",
			callback: async () => {
				const canvStruct = await this.readCanvasStruct();
				if (canvStruct == false) {
					new Notice(`this is not a canvas file`);
					return;
				}

				const contents = await this.readCanvasData(canvStruct);

				this.writeCanvDocFile(contents, canvStruct);

			},
		});

		this.addCommand({
			id: "run-redoc",
			name: "Clear canvas2document target document",
			callback: async () => {
				const canvStruct = await this.readC2Dtarget();
				if (canvStruct == false) {
					new Notice(`this is not a canvas2document target file`);
					return;
				}

				// const contents = await this.readCanvasData(canvStruct);

				this.writeC2Doc(canvStruct);
			},
		});

	}

	onunload() {
		// TODO cleaning up
	}

	async readC2Dtarget(): Promise<number> {
		/*
		check on active file is canvas
		*/
		let activeFile = this.app.workspace.getActiveFile();

		//filename of the active file contains "_fromCanvas.md"
		if (!activeFile || !activeFile.name.includes("_fromCanvas.md")) {
			return false;
		} else {
			let mdFolderPath: string = path.dirname(activeFile.path);
		}

		// TODO: prevent reading all files, just the active file, if canvas check ok

		//let actcanvasfile = app.vault.getAbstractFileByPath(activeFile);
		let content = this.app.vault.cachedRead(activeFile);

		return content;
	}	


	async writeC2Doc(canvStruct) {

		let activeFile = this.app.workspace.getActiveFile();
		let mdFolderPath: string = path.dirname(activeFile.path);

		const pattern = /\!\[\[([^[\]]+)\]\]/g;
		const matches = canvStruct.match(pattern);

		let doccontentstring = "> [!success] This is your converted and cleared document from Canvas2Document\n\> (you can delete this infobox)\n\n"

		if (! matches) {
			return
		}

		let textfilenames = []
		let filenames = []

		matches.forEach(match => {
			let embeddedfilename = match.replace(/\!\[\[(.*)\]\]/, '$1');

			if (embeddedfilename.endsWith(".md")) {
				// if embeddedfilename starts with "./" remove it
				if (embeddedfilename.startsWith("./")) {
					embeddedfilename = embeddedfilename.replace("./", "")
				}
				textfilenames.push(embeddedfilename);
			} 

			filenames.push(embeddedfilename);
		});

		const fileContents = await Promise.all(
			textfilenames.map(
			  async (file) => [file, await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(file))] as const,
			),
	    );

		for (const xfile of filenames) {
			if (xfile.endsWith(".md")) {
				const found = fileContents.find((element) => element[0] == xfile);
				doccontentstring += found[1] + "\n\n"
			} else {
				doccontentstring += "![[" + xfile + "]]\n\n"
			}
		}

		let docFilename
		if (mdFolderPath == ".") {
	    	docFilename = activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromC2D.md"
		} else {
			docFilename = mdFolderPath + "/" + activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromC2D.md"					
		}

		try {
			await this.app.vault.create(docFilename, doccontentstring)
		} catch (e) {
			console.log("error writing the new cleare doc file " + e)
		}

		const docftab = await this.app.vault.getAbstractFileByPath(docFilename);

		try {
			await this.app.workspace.getLeaf('split').openFile(docftab);
		} catch (e) {
			console.log(e)
		}
		return
	}

	async readCanvasStruct(): Promise<number> {
		/*
		check on active file is canvas
		*/
		let activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension != "canvas") {
			return false;
		} else {
			let mdFolderPath: string = path.dirname(activeFile.path);
		}

		// TODO: prevent reading all files, just the active file, if canvas check ok

		//let actcanvasfile = app.vault.getAbstractFileByPath(activeFile);
		let content = this.app.vault.cachedRead(activeFile);

		return content;
	}	


	async readCanvasData(struct): Promise<number> {
		// TODO: nochmal nach https://docs.obsidian.md/Plugins/Vault, read all files
		// input liste eben aus canvas-JSON alle nodes

		const fileContents: [string, string, string, string][] = [];

		let  myparsed_data = JSON.parse(struct);

		for (const node of myparsed_data.nodes) {
			const id = node.id;
			const type = node.type;
			let nodefile = "";

			if (type === "file") {
				nodefile = node.file;
				const { name, ext } = path.parse(nodefile);

				// main file type markdown note
				if (ext === ".md") {
					fileContents.push([id, type, nodefile, "textfile"]);

				} else if (ext === ".jpg" || ext == ".jpeg" || ext === ".png" || ext === ".gif") {
					fileContents.push([id, type, nodefile, "contentimage"]);
				} else if (ext === ".pdf") {
					fileContents.push([id, type, nodefile, "contentpdf"]);
				} else {
					//TODO handle unknown file type");
				}
			} else if (type === "link") {
				if (node.url.includes("youtube")) {
					const url = node.url;
					fileContents.push([id, type, url, "contentyoutube"]);
				} else {
					fileContents.push([id, type, node.url, "contentlink"]);
				}
			} else if (type === "text") {
				const text = node.text;

				fileContents.push([id, type, "node", text]);
			}
		}

		return fileContents;
	}

	getNodes(id) {
		// get all nodes from the canvas file
		// return array of nodes
		return;
		
	}
	
	async writeCanvDocFile(content, convStruct) {
		// establishing the workdir
		let activeFile = this.app.workspace.getActiveFile();
		let mdFolderPath: string = path.dirname(activeFile.path);

		let writeworkdir = mdFolderPath + "/" + activeFile.basename + "_canvas2doc-data"
		this.fsadapter.mkdir(writeworkdir)

		let canvasFile
		let canvasFilename
		if (mdFolderPath == ".") {
	    	canvasFilename = activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromCanvas.md"
		} else {
			canvasFilename = mdFolderPath + "/" + activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromCanvas.md"					
		}

		let contentString = "> [!info] This is an automatically generated document from Plugin [Canvas2Document](https://github.com/slnsys/obsidian-canvas2document)\n\> arrange the document as you need with the outline, then call *Clear canvas2document target document*\n\n"

		let myparsed_data = JSON.parse(convStruct);

		for (const element of content) {
			
			let cnfname = ""
			if (element[1] == "text") {
				
				cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + "_fromCanvas.md"
				
				// heading für navi links
				contentString += "\n\n# ___card from Canvas\n"

				// Filename und interner link anchor
				contentString += element[2] + " ^" + element[0] + "\n\n"

				// linking box
				contentString += "> [!tip] link navigation from the canvas\n"
				for (const edge of myparsed_data.edges) {
					if (edge.fromNode == element[0]) {
						contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
					} 
					if (edge.toNode == element[0]) {
						contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
					} 
				}

				//Embedding
				contentString += "\n ![[" + cnfname + "]]\n\n"

			} else if (element[1] == "link") {
				// cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + " _fromCanvas.md"

				// heading für navi links
				contentString += "\n\n# ___link from Canvas\n"

				// Filename und interner link anchor
				contentString += element[2] + " ^" + element[0] + "\n\n"

				// linking box
				contentString += "> [!tip] link navigation from the canvas\n"
				for (const edge of myparsed_data.edges) {
					if (edge.fromNode == element[0]) {
						contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
					} 
					if (edge.toNode == element[0]) {
						contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
					} 
				}

				//Embedding media specific
				if (element[3] == "contentyoutube") {
					contentString += "\n ![](" + element[2] + ")\n\n"
				} else if (element[3] == "contentlink") {
					contentString += "\n <iframe src=\"" + element[2] + "\"></iframe>\n\n"
				}

			} else if (element[1] == "file") {
				if (element[3] == "contentimage" || element[3] == "contentpdf") {

					// heading für navi links
					contentString += "\n\n# ___Media from Canvas\n"
				
					// starttag meta data block
					// contentString += "\n%%\ncanvas2document plugin metadata header start\n%%\n"

					// Filename und interner link anchor
					contentString += element[2] + " ^" + element[0] + "\n\n"

					// linking box
					// TODO linking box noch in funktion auslagern
					contentString += "> [!tip] link navigation from the canvas\n"
					for (const edge of myparsed_data.edges) {
						if (edge.fromNode == element[0]) {
							contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
						} 
						if (edge.toNode == element[0]) {
							contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
						} 
					}
					// starttag meta data block
					// contentString += "\n%%\ncanvas2document plugin metadata header end\n%%\n"
				
					//Embedding media specific
					if (element[3] == "contentpdf") {
						contentString += "\n ![[" + element[2] + "#height=500]]\n\n"
					} else if (element[3] == "contentimage") {
						contentString += "\n ![[" + element[2] + "|500]]\n\n"
					}				

				} else {
					
					// heading für navi links
					contentString += "\n\n# ___noteFile from Canvas\n"
				
					// Filename und interner link anchor
					contentString += element[2] + " ^" + element[0] + "\n\n"

					// linking box
					contentString += "> [!tip] link navigation from the canvas\n"
					for (const edge of myparsed_data.edges) {
						if (edge.fromNode == element[0]) {
							contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
						} 
						if (edge.toNode == element[0]) {
							contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
						} 
					}
				
					// Embedding
					contentString += "\n ![[" +  element[2] + "]]\n\n"

				}
			}

			let canvasnodeFile

			try {
				let cnfabst = this.app.vault.getAbstractFileByPath(cnfname);
				this.app.vault.delete(cnfabst, true)
				canvasnodeFile = this.app.vault.create(cnfname, element[3])
			} catch (e) {
				console.log(e)
				return
			}	

		}

   	    try {
	      canvasFile = await this.app.vault.create(canvasFilename, contentString)
	    } catch (e) {
			console.log("error writing the new doc file " + e)
		}

		const cnfabst = await this.app.vault.getAbstractFileByPath(canvasFilename);

		try {
			await this.app.workspace.getLeaf('split').openFile(cnfabst);
		} catch (e) {
			console.log(e)
		}
		return

	}
}

