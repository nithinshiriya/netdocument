/**	Javascript library for the NetDocuments REST API.  Call to .init function is required to using this library.
*   @class The encompassing class that contains all necessary calls to operate the NetDocuments REST API via javascript.
*/
var API = (function (library) {
    var api = {
        state: {},
		/**	Most if not all API calls should go through this function.
		*	@private	
		*	@param {string} url The url of the ajax call.
		*	@param {string} token The access token to be used in the call.
		*	@param {object} data A JS object that will be turned into post or query arguments.
		*	@param {function} handler A function with the signature function(data, status, jqxhr) that is called after a successful Ajax call.
		*	If null then a synchronous call is made and results are returned directly.
		*	@param {string} [type] HTTP call type, defaults to GET
		*	@param {function} [error] A function with the same signature as defaultErrorHandler called when there is an error during the ajax call.
		*	If null then errors are thrown from synchronous calls and displayed in a messsagebox after asynchronous calls.
		*	@param {object} [extraSttings] Extra settings passed to the jQuery ajax call.  When passing in a FormData object use 
		*	{ processData: false, contentType: false} so jQuery does the right thing.
		*/
        doAjaxCall: function (url, token, data, handler, type, error, extraSettings) {
            if (url == undefined || api.state.baseUrl == undefined) {
                throw "url is a required parameter.";
            }
            if (token == undefined || token == null || token.length == 0) {
                throw "token is a required parameter";
            }
            if (type == undefined) type = "GET";
            var async;
            if (handler == undefined) {
                async = false;
                api.state.syncRet = undefined;
                api.state.syncErr = undefined;
                api.state.syncStatus = undefined;
                handler = defaultSyncSuccessHandler;
                if (error == undefined)
                    error = defaultSyncErrorHandler;
            } else {
                async = true;
                if (error == undefined)
                    error = defaultAsyncErrorHandler;
            }

            var callSettings = {
                url: url,
                data: data,
                async: async,
                success: handler,
                error: error,
                dataType: "json",
                type: type,
                headers: { Authorization: "Bearer " + token }
            };
            if (extraSettings != undefined)
                $.extend(callSettings, extraSettings);
            $.ajax(callSettings);

            if (!async) {
                if (api.state.syncErr != null)
                    throw (api.state.syncErr);
                return api.state.syncRet;
            }
        }
    };

	/** Default async error handler. 
	*	@private
	*/
    function defaultAsyncErrorHandler(jqXHR, textStatus, errorThrown) {
        alert(errorThrown);
    }

	/** Default synchronous error handler. 
	*	@private
	*/
    function defaultSyncErrorHandler(jqXHR, textStatus, errorThrown) {
        var err = Error(jqXHR.status + " " + errorThrown + " " + jqXHR.responseText);
        err.error = errorThrown;
        err.status = jqXHR.status;
        err.errorDesc = jqXHR.responseText;
        err.errorObj = jqXHR.responseJSON
        api.state.syncErr = err;
        api.state.syncStatus = jqXHR.status;
        api.state.lastResponse = jqXHR;
    }

	/** Default synchronous success handler 
	*	@private
	*/
    function defaultSyncSuccessHandler(data, status, jqxhr) {
        if (data != null)
            api.state.syncRet = data;
        else if (jqxhr.responseText.length > 0)
            api.state.syncRet = JSON.parse(jqxhr.responseText);
        else
            api.state.syncRet = '';
        api.state.syncStatus = jqxhr.status;
        api.state.lastResponse = jqxhr;
    }

	/**	Update an expired access token
	*	@public
	*	@param {String} token The new access token
	*/
    function setAccessToken(token) {
        api.state.accessToken = token;
    }

	/** Parse the query portion of a URL and return an object with a named property for each parameter. 
	*	@private
	*	@param {String} url
	*/
    function parseQuery(url) {
        var urlParams = {};
        var match;
        var pl = /\+/g;  // Regex for replacing addition symbol with a space
        var search = /([^&=]+)=?([^&]*)/g;
        /**	@inner	*/
        var decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); };
        var query;
        var sep = url.indexOf('?');
        if (sep > 0)
            query = url.substr(sep + 1);
        else
            query = '';

        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2]);
        return urlParams;
    }

	/** Append a parameter to the query portion of a URL. 
	*	@private
	*/
    function appendParam(url, name, value) {
        var sep = url.indexOf('?');
        var prefix = (sep > 0) ? '&' : '?';
        url += prefix + name + '=' + encodeURIComponent(value);
        return url;
    }

	/** Build an extension list filter 
	*	@private
	*/
    function buildExtensionFilter(extensions) {
        var filterList = '';
        if (extensions != null && extensions.length > 0) {
            var extList = []
            if (extensions.constructor === String) extList = extensions.split(',');
            else if (extensions instanceof Array) extList = extensions;
            else throw "Extension list must be a comman delimeted string or an array";
            for (var i = 0; i < extList.length; i++) {
                var ext = extList[i].trim();
                if (ext.length == 0)
                    continue;
                filterList += ' or extension eq ' + ext;
            }
        }
        return filterList.length > 0 ? filterList.substr(4) : filterList;
    }

	/** Create an access entry.  An ACL is an array of access entries.
	*	@public
    *   @param {string} principal - ID of a user, group, or cabinet
    *   @param {string} rights - Combination of V, E, S, and A or N or Z.  Z can only be used with cabinet principals.
    */
    function createAccessEntry(principal, rights) {
        var ace = {};
        ace.principal = principal;
        if (principal.length > 3 && principal.substr(0, 3) == "NG-") {
            if (rights == "Z")
                ace.cabDefault = true;
            else
                throw "Invalid access rights specified for a cabinet";
        }
        if (rights == "N")
            ace.no_access = true;
        else if (rights.indexOf("V") < 0)
            throw "Invalid access rights specified";
        ace.view = true;
        if (rights.indexOf("E") >= 0)
            ace.edit = true;
        if (rights.indexOf("S") >= 0)
            ace.share = true;
        if (rights.indexOf("A") >= 0)
            ace.administer = true;
        return ace;
    }

	/**	Get the previous calls status.
	*	@public
	*/
    function prevSyncStatus() {
        return api.state.syncStatus;
    }

	/** 
    *   @class Document APIs
    *   @example Document IDs take one of the following forms:<br/>
    *       envelope ID, i.e. :Q12:a:b:c:d:~121106123412345.nev <br/>
    *       12 digit numeric id formatted ####-####-####
    */
    var Document = (function () {
		/**	@private
		*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Document/"; };

		/** Retrieve document profile data or version details
        * @param {string} id Document id
        * @param {int} [version] Version number.  0 to retrieve document profile.
        * @param {bool} [useMvp] If true the full attribute MVP value will be returned, otherwise - only the primary value.
		* @param {Object} [extras] Any additional parameters that need to be considered.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined && p.version.toString().match(/^\d+$/)) url += "/" + p.version;
            url += "/info";
            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve document ACL 
        * @param {string} id Document id
        * @param {int} [version] Version number.  Defaults to 0.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined && p.version.toString().match(/^\d+$/)) url += "/" + p.version;
            url += "/acl";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve document content 
        * @param {string} id Document id.
        * @param {int} [version] Version number.  Defaults to the official version.
        * @param {bool} [addToRecent] If true the document will be added to the user's Recently Opened Documents list.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getContent(p) {
            var queryArgs = {};
            if (p.addToRecent)
                queryArgs.addToRecent = "Y";
            if (p.replica && p.container) {
                queryArgs.replica = p.replica;
                queryArgs.container = p.container;
            }
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined)
                url += "/" + p.version
            return api.doAjaxCall(url, api.state.accessToken, queryArgs, p.success, "GET", p.error, { dataType: "text", accepts: { text: "application/json, text/plain" } });
        }

		/** Retrieves document version list 
        * @param {string} id Document id.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getVersionList(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/versionList/";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "json" });
        }

		/** Retrieves contents of the specified attachment
		* @param {string} id Document id.
		* @param {string} attachmentId Attachment Id.
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		* @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAttachment(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/attachment";
            if (p.attachmentId == undefined) throw "attachment id is required.";
            url += "?attachmentId=" + p.attachmentId;
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "text", accepts: { text: "application/json, text/plain" } });
        }

		/** Retrieves documents attachments list 
		* @param {string} id Document id.
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		* @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAttachmentList(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/attachmentList";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "json" });
        }

	    /** Retrieve document links
        * @param {string} id Document id.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getLinks(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/links";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "json" });
        }

	    /** Retrieve document signatures
        * @param {string} id Document id.
        * @param {int} [version] Version number.  Defaults to the official version.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getSignatures(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined)
                url += "/" + p.version;
            url += "/signatures";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "json" });
        }

	    /** Retrieve document approvals
        * @param {string} id Document id.
        * @param {int} [version] Version number.  Defaults to the official version.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getApprovals(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined)
                url += "/" + p.version;
            url += "/approvals";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "json" });
        }

		/** Upload new file (also called <b>Create</b>) 
        * @param {file} [file] File object to upload, if left empty new document contents are empty.
        * @param {string} [cab] Cabinet ID to upload file to; ignored if dest is specified.
        * @param {string} [dest] Id of folder, workspace, or sharespace that file should be put in.
        * @param {string} [name] Name of file.  Defaults from file object.
        * @param {string} [ext] File extension. Defaults from file object.
        * @param {string or Date} [lastmod] Last modified date/time for the document.  Defaults to current date/time.
        * @param {Profile[]} [profile] Array of custom profile objects to set on the new document.
        * @param {bool} [allowClosed] Boolean specifing whether closed attribute values are allowed
        * @param {ACL[]} [acl] Array of ACL objects to set on the new document.
        * @param {bool} [full_return] How much information do you want back on success?
        * @param {bool} [addToRecent] If true the document will be added to the user's Recently Added Documents list.
		* @param {bool} [checkOut] If true the document will be checked out.
		* @param {bool} [comment] Optional comment associated with checking out the document.
		* @param {bool} [updateRecentAttributes] Update the users recently used attributes list.
		* @param {bool} [partialProfiling] If true, allows partial profiling when uploading a document to a workspace/filter
		* @param {string} [aclStatus] aclStatus (frozen/thawed)
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function postNewFile(p) {
            var action = "upload";
            if (p.file == undefined) action = "create";
            else if (p.name == undefined || p.name == "" || p.ext == undefined || p.ext == "") {
                var pieces = p.file.name.split(".");
                if (p.name == undefined || p.name == "")
                    p.name = pieces[0];
                if (p.ext == undefined || p.ext == "")
                    p.ext = pieces[1];
            }
            if (p.name == undefined || p.name == "") throw "No name provided.";
            if (p.ext == undefined || p.ext == "") throw "No ext provided.";
            if (p.lastmod == undefined && p.file != undefined && p.file.lastModifiedDate != undefined)
                p.lastmod = p.file.lastModifiedDate;
            var data = new FormData();
            data.append("action", action);
            if (p.cab != undefined && p.cab != "")
                data.append("cabinet", p.cab);
            data.append("name", p.name);
            data.append("extension", p.ext);
            if (p.full_return != undefined && p.full_return) {
                data.append("return", "full")
            }
            if (p.dest != undefined && p.dest != "")
                data.append('destination', p.dest);
            if (p.profile != undefined && p.profile != "")
                data.append('profile', JSON.stringify(JSON.parse(p.profile)));
            if (p.allowClosed != undefined && p.allowClosed)
                data.append('allowClosed', 'true');
            if (p.acl != undefined && p.acl != "")
                data.append('acl', JSON.stringify(JSON.parse(p.acl)));
            if (p.checkOut != undefined && p.checkOut)
                data.append('checkOut', 'true');
            if (p.comment != undefined && p.comment.length > 0)
                data.append('comment', p.comment);
            if (p.lastmod instanceof Date)
                data.append('modified', p.lastmod.toISOString());
            else if (typeof (p.lastmod) == 'string' && p.lastmod.length > 0)
                data.append('modified', p.lastmod);
            if (p.addToRecent)
                data.append('addToRecent', 'true');
            if (typeof (p.nevfile) == 'string' && p.nevfile.length > 0)
                data.append('nevfile', p.nevfile);
            if (p.updateRecentAttributes)
                data.append('updaterecentattributes', 'true');
            if (p.failOnError)
                data.append('failOnError', 'true');
            if (p.partialProfiling)
                data.append('partialProfiling', 'true');
            if (p.aclStatus)
                data.append('aclStatus', p.aclStatus);
            if (p.extraValues != undefined) {
                for (var key in p.extraValues)
                    data.append(key, p.extraValues[key]);
            }
            data.append("file", p.file);
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error,
                {
                    processData: false,
                    contentType: false,//"multipart/form-data",
                    //mimeType: "multipart/form-data"
                });
        }

		/** Checkout a document 
        * @param {string} id Document id.
        * @param {string} [comment] optional checkout comment.
        * @param {bool} [download] Do you want to download the file as well?
		* @param {boolean} [addToRecent] If true, the document will be added to the user's Recently Opened Documents list.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function postCheckOut(p) {
            if (p.id == undefined) throw "id is required.";
            /**	Default values */
            var data = {
                "action": "checkout",
            };
            if (p.comment == undefined) p.comment = "";
            if (p.download == undefined) p.download = false;
            data = $.extend(data, p);
            if (data.success)
                delete data.success;
            if (data.error)
                delete data.error;
            var extraSettings = {
                dataType: "json"
            };
            if (p.download) {
                data.download = "Y";
                extraSettings.dataType = "text";
            }
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error,
                extraSettings
            );

        }
		/** Check in a document 
        * @param {string} id Document id.
        * @param {File} [file] Optional file object to check in.
        * @param {string} [extension] New file extension.  Only used in conjunction with file.
		* @param {boolean} [addToRecent] If true, the document will be added to the user's Recently Edited Documents list.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function postCheckIn(p) {
            if (p.id == undefined) throw "id is required.";

            if (p.file != undefined) {
                var data = new FormData();
                data.append("action", "checkin");
                data.append("id", p.id);
                if (p.addToRecent != undefined)
                    data.append("addToRecent", p.addToRecent);
                if (p.extension != undefined)
                    data.append("extension", p.extension);
                data.append("file", p.file);
                return api.doAjaxCall(
                    apiUrl(),
                    api.state.accessToken,
                    data,
                    p.success,
                    "POST",
                    p.error,
                    {
                        processData: false,
                        contentType: false,
                    });
            } else {
                return api.doAjaxCall(
                    apiUrl(),
                    api.state.accessToken,
                    { action: "checkin", id: p.id },
                    p.success,
                    "POST",
                    p.error
                );
            }
        }

	    /** Undelete a document 
        * @param {string} id Document id.
        */
        function postUndelete(p) {
            if (p.id == undefined)
                throw "id is required.";

            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                { action: "undelete", id: p.id },
                p.success,
                "POST",
                p.error
            );
        }

		/** Copy an existing document or version to a new document
        * @param {string} id Original document id
        * @param {int} [version] Version of original document
        * @param {string} [cabinet] Destination cabinet id, defaults to same as original document
        * @param {string} [destination] Folder, Workspace, or Sharespace id that new document will be copied into.
        * @param {string} [name] Name of new document.
        * @param {bool} [addToRecent] If true the document will be added to the user's Recently Added Documents list.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function postCopy(p) {
            if (p.id == undefined) throw "id is required.";
            var data = $.extend({ "action": "copy" }, p);
            if (data.success)
                delete data.success;
            if (data.error)
                delete data.error;
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error
            );
        }

		/** Lock an existing version of a document
		* @param {string} id Document id
		* @param {int} version Version to lock
		* @param {string} [description] Updated version description
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postLockVersion(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.version == undefined) throw "version is required.";
            var data = $.extend({ "action": "lock" }, p);
            if (data.success) delete data.success;
            if (data.error) delete data.error;
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error
            );

        }

		/** Lock an existing version of a document
		* @param {string} id Document id
		* @param {int} version Version to revoke access
		* @param {string} [description] Updated version description
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postRevokeAccess(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.version == undefined) throw "version is required.";
            var data = $.extend({ "action": "revokeaccess" }, p);
            if (data.success) delete data.success;
            if (data.error) delete data.error;
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error
            );

        }

	    /** Change the official version of a document
		* @param {string} id Document id
		* @param {int} version Version to become the official version
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postChangeOfficial(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.version == undefined) throw "version is required.";
            var data = $.extend({ "action": "officialversion" }, p);
            if (data.success) delete data.success;
            if (data.error) delete data.error;
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error
            );

        }

	    /** Add a record to the document history
		* @param {string} id Document id
		* @param {int} [version] (optional) Version the log record applies to
		* @param {string} historyAction - Text of the log entry
        * @param {string} [logAction] (optional) Action code for a consolidated log entry
		* @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postLogAction(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.historyAction == undefined) throw "historyAction is required.";
            var data = $.extend({ "action": "logactivity" }, p);
            if (data.success) delete data.success;
            if (data.error) delete data.error;
            return api.doAjaxCall(
                apiUrl(),
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error
            );
        }

	    /** Upload new file contents 
        * @param {File} file File to upload
        * @param {string} id Document id
        * @param {int} [version] Version number to upload.  Defaults to official version.  Passing in "new" creates a new version.
        * @param {string} [extension] New file extension
        * @param {string} [description] New version description
        * @param {bool} [official] Whether the newly uploaded content should be the official version.
        * @param {bool} [addToRecent] If true the document will be added to the user's Recently Edited Documents list.
        * @param {int} [srcVer] When creating a new version, specifies an existing version to copy from.  Ignored if file
        *       is specified.  If neither srcVer or file are supplied the official version is copied.
		* @param {bool} [checkOut] Whether to checkout a new version of a document or not.
		* @param {bool} [base64] True if the document content is base64 encoded
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putFileContents(p) {
            if (p.file == undefined) throw "file is required.";
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined && p.version) url += "/" + p.version;
            if (p.extension != undefined || p.description != undefined || p.official != undefined || (p.checkOut != undefined && p.version == "new") || p.addToRecent != undefined || p.base64 != undefined || p.extraValues != undefined) {
                url += "?";
                if (p.extension != undefined && p.extension) url += "extension=" + p.extension + "&";
                if (p.description != undefined && p.description) url += "versiondescription=" + p.description + "&";
                if (p.addToRecent) url += "addToRecent=Y&";
                if (p.official != undefined && p.official) url += "official=Y&";
                if (p.checkOut != undefined && p.checkOut && p.version == "new") url += "checkOut=Y&";
                if (p.base64 != undefined && p.base64 && p.base64 == "true") url += "base64=true&";
                if (p.extraValues != undefined) {
                    $.each(p.extraValues, function (key, value) {
                        url += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
                    });
                }
                url = url.replace(/&$/, "");
            }
            return api.doAjaxCall(
                url,
                api.state.accessToken,
                p.file,
                p.success,
                "PUT",
                p.error,
                {
                    processData: false,
                    contentType: p.file.type
                });
        }

		/** Create a new version without uploading content.  Use putFileContents() when uploading content.
        * @param {string} id Document id
        * @param {string} [extension] New version extension
        * @param {string} [description] New version description
        * @param {bool} [official] Whether the new version should be the official version.
        * @param {bool} [addToRecent] If true the document will be added to the user's Recently Edited Documents list.
        * @param {int} [srcVer] Specifies an existing version to copy from.  If not specified the official version is copied.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putNewVersion(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            url += "/new";
            if (p.extension != undefined || p.description != undefined || p.official != undefined || p.addToRecent != undefined || p.srcVer != undefined) {
                url += "?";
                if (p.extension != undefined) url += "extension=" + p.extension + "&";
                if (p.description != undefined) url += "version_description=" + p.description + "&";
                if (p.addToRecent) url += "addToRecent=Y&";
                if (p.srcVer != undefined && p.file == undefined) url += "srcVer=" + p.srcVer + "&";
                if (p.official != undefined && p.official) url += "official=Y&";
                url = url.replace(/&$/, "");
            }
            return api.doAjaxCall(
                url,
                api.state.accessToken,
                p.file,
                p.success,
                "PUT",
                p.error,
                {
                    processData: false,
                    contentType: "application/json"
                });
        }

		/** Create/update an attachment for a document. To update the attachment make sure the "type" is the same
		*	as the attachment you want to update.
        * @param {string} id Document id
        * @param {File} file Attachment to upload
        * @param {string} [name] New attachments name.  If you are replacing an existing at
        * @param {string} type The type of attachment.  Each type should be unique to that attachment.  Put the type of an already existing attachment to replace that attachment.
        * @param {string} extension The file extension of the attachment.
        * @param {string} [description] The description of the attachment.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putAttachment(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            url += "/attachment";
            if (p.type == undefined) throw "attachment type is required.";
            url += "/" + p.type;
            if (p.extension == undefined) throw "attachment extension is required.";
            url += "?ext=" + p.extension;
            if (p.name) {
                url += "&name=" + p.name;
            }
            if (p.description != undefined) {
                url += "&description=" + p.description;
                url = url.replace(/&$/, "");
            }
            return api.doAjaxCall(url, api.state.accessToken, p.file, p.success, "PUT", p.error, { processData: false });
        }

		/** Set a new ACL 
        * @param {ACL[]} acl Array of ACL objects or User IDs to set on the document.
        * @param {string} id Document id.
        * @param {int} [version] Defaults to the official version.  If a non official version is specified
        *        ACL should be an array of strings each specifying a user id to grant permission on the
        *        version.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putAcl(p) {
            if (p.acl == undefined) throw "acl is required.";
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined) url += "/" + p.version;
            url += "/acl";

            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }

            var extraSettings = { processData: false, contentType: "application/json" };

            if ($.type(p.acl) != "string") p.acl = JSON.stringify(p.acl);
            api.doAjaxCall(
                url,
                api.state.accessToken,
                p.acl,
                p.success,
                "PUT",
                p.error,
                extraSettings);
            return api.state.syncStatus;
        }
		/** Update document custom properties or name 
        * @param {DocumentInfo Object} info Document info object with some combination of the new document name
        * and custom document attributes.  Object should match the one returned from a getInfo call.
        * @param {string} id Document id.
        * @param {int} [version] If version is supplied then the version details will be update for the given version number.
        * @param {bool} [allowClosed] Boolean specifing whether closed attribute values are allowed
		* @param {bool} [updateRecentAttributes] Update the users recently used attributes list.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putInfo(p) {
            if (p.info == undefined) throw "info is required.";
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.version != undefined) { url += "/" + p.version; }
            url += "/info";
            if (p.allowClosed != undefined && p.allowClosed) {
                url += "?allowClosed=true"
            }
            if ($.type(p.info) != "string") p.info = JSON.stringify(p.info);
            var processData = false;
            if (p.updateRecentAttributes) {
                if (!p.allowClosed)
                    url += '?updaterecentattributes=true';
                else
                    url += '&updaterecentattributes=true';
            }
            if (p.extras) {
                if (!(p.allowClosed || p.updateRecentAttributes))
                    url += "?";
                else
                    url += '&';
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                processData = true;
                url = url.replace(/\&$/, "");
            }
            api.doAjaxCall(
                url,
                api.state.accessToken,
                p.info,
                p.success,
                "PUT",
                p.error,
                {
                    processData: processData,
                    contentType: "application/json"
                });
            return api.state.syncStatus;
        }

		/** Link to other documents
        * @param {string[]} targets Array of documents to link to.
        * @param {string} id Document id.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putLinks(p) {
            if (p.targets == undefined) throw "targets is required.";
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/links";
            if ($.type(p.targets) != "string") p.targets = JSON.stringify(p.targets);
            api.doAjaxCall(
                url,
                api.state.accessToken,
                p.targets,
                p.success,
                "PUT",
                p.error,
                {
                    processData: false,
                    contentType: "application/json",
                });
            return api.state.syncStatus;
        }

		/** Delete a document or version
        * @param {string} id Document id.
        * @param {int} [version] Version to delete
        * @param {bool} [permanent] If true the document will be permanently deleted, rather than being moved to the cabinet's Deleted Items.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function deleteDoc(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var data = null;
            if (p.replica != null && p.container != null) {
                //data = { 'replica': p.replica, 'container': p.container };
                url += "?replica=" + encodeURIComponent(p.replica) + "&container=" + encodeURIComponent(p.container);
            }
            if (p.version != undefined && p.version.toString().match(/^\d+$/)) url += "/" + p.version;
            if (p.permanent) {
                if (url.indexOf("?") > 0)
                    url += "&permanent=" + p.permanent;
                else
                    url += "?permanent=" + p.permanent;
            }
            api.doAjaxCall(
                url,
                api.state.accessToken,
                data,
                p.success,
                "DELETE",
                p.error
            );
        }



        return {
            deleteItem: deleteDoc,
            getInfo: getInfo,
            getAcl: getAcl,
            undelete: postUndelete,
            getContent: getContent,
            getVersionList: getVersionList,
            getAttachment: getAttachment,
            getAttachmentList: getAttachmentList,
            getLinks: getLinks,
            getSignatures: getSignatures,
            getApprovals: getApprovals,
            create: postNewFile,
            checkOut: postCheckOut,
            checkIn: postCheckIn,
            copy: postCopy,
            lockVersion: postLockVersion,
            revokeAccess: postRevokeAccess,
            officialVersion: postChangeOfficial,
            logAction: postLogAction,
            putFileContents: putFileContents,
            putInfo: putInfo,
            putAttachment: putAttachment,
            putAcl: putAcl,
            putNewVersion: putNewVersion,
            putLinks: putLinks
        }
    })();

	/** 
    *   @class Workspace APIs 
    *   @example Workspace IDs take one of the following forms:<br/>
    *       API ID, i.e. :Q12:a:b:c:d:^W12110612341234.nev<br/>
    *       12 digit numeric workspace id formatted ####-####-####<br/>
    *       cabGuid + workspace attr values, i.e. NG-ABCD123/Client1/Matter3
    */
    var Workspace = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Workspace/"; };

		/** Retrieve workspace profile data 
		*	@param {String} id Workspace id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve workspace documents 
		*	@param {String} id Workspace id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getDocuments(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/documents";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve workspace ACL 
		*	@param {String} id Workspace id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve list of workspace containers
		*	@param {String} id Workspace id
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getContainers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Delete a workspace 
		*	@param {String} id Workspace id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function remove(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error, { dataType: "text" });
        }

		/** Add a workspace to the Favorite Workspaces list 
		*	@param {String} id Workspace id
		*   @param {bool} (info) Whether to return the workspace information when done defaults to false
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function addToFavorites(p) {
            if (p.id == undefined) throw "id is required.";
            var params = {};
            params.id = p.id;
            params.action = "addToFavorites";
            if (p.info != undefined && p.info) params.info = "t";
            return api.doAjaxCall(apiUrl(), api.state.accessToken, params, p.success, "POST", p.error);
        }

		/** Add a workspace to the Recent Workspaces list 
		*	@param {String} id Workspace id
		*   @param {bool} (info) Whether to return the workspace information when done defaults to false
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function addToRecent(p) {
            if (p.id == undefined) throw "id is required.";
            var params = {};
            params.id = p.id;
            params.action = "addToRecent";
            if (p.info != undefined && p.info) params.info = "t";
            return api.doAjaxCall(apiUrl(), api.state.accessToken, params, p.success, "POST", p.error);
        }

		/** Modify workspace ACL 
		*	@param {String} id Workspace id
		*	@param {ACL[]} acl Array of ACL objects to set on the new document.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";

            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }

            var data = JSON.stringify(p.acl);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json', dataType: "text" });
        }

		/** Modify workspace profile 
		*	@param {String} id Workspace id
		*	@param {JSON} info
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            var data = JSON.stringify(p.info);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json', dataType: "text" });
        }

		/** File a document in a workspace
		*	@param {String} id Workspace id
		*   @param {String} item - id of the document to be filed in the workspace
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function file(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var params = {};
            params.item = p.item;
            params.action = "file";
            return api.doAjaxCall(url, api.state.accessToken, params, p.success, "POST", p.error);
        }

		/** Add an existing saved search to a workspace
		*	@param {String} id Workspace id
		*   @param {String} item - id of the saved search to be added to the workspace
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function addSavedSearch(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var params = {};
            params.item = p.item;
            params.action = "addSavedSearch";
            return api.doAjaxCall(url, api.state.accessToken, params, p.success, "POST", p.error);
        }

	    /** Reset a workspace.
        *   @param {String} id Workspace id
        *	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function reset(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var params = {};
            params.action = "reset";
            return api.doAjaxCall(url, api.state.accessToken, params, p.success, "POST", p.error);
        }
		/** Refresh a workspace.
        *   @param {String} id Workspace id
        *	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function refresh(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var params = {};
            params.action = "refresh";
            return api.doAjaxCall(url, api.state.accessToken, params, p.success, "POST", p.error);
        }

        return {
            getInfo: getInfo,
            getDocuments: getDocuments,
            getAcl: getAcl,
            getContainers: getContainers,
            deleteItem: remove,
            "delete": remove,
            remove: remove,
            addToFavorites: addToFavorites,
            addToRecent: addToRecent,
            putAcl: putAcl,
            putInfo: putInfo,
            file: file,
            addSavedSearch: addSavedSearch,
            reset: reset,
            refresh: refresh
        }
    })();

	/** 
    *   @class Folder APIs 
    *   @example Folder IDs take one of the following forms:<br/>
    *       API ID, i.e. :Q12:a:b:c:d:^F12110612341234.nev<br/>
    *       12 digit numeric folder id formatted ####-####-####
    */
    var Folder = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Folder/"; };

		/** Retrieve folder profile data 
		*	@param {String} id Folder id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve folder ACL 
		*	@param {String} id Folder id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve ID of folder's parent 
		*	@param {String} id Folder id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getParent(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/parent";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve ancestors of a folder 
		*	@param {String} id Folder id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAncestors(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/ancestry";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve list of items filed in the folder 
		*	@param {string} id Folder id
        *	@param {boolean} extensions null to return all folder contents, ndfld to return subfolders only, or a comma-separated
        *   list of file extensions to only return contents with matching extensions.
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {integer} [maxResults] The maximum # of results to return from each call.
        *   @param {string} [skipToken] null for the initial call.  To retrieve additional results after the first block, pass the skipToken
        *	returned from the previous call.		
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
       */
        function getContents(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            if (p.sort != null && p.sort.length > 0)
                url = appendParam(url, '$orderby', p.sort);
            if (p.maxResults) {
                url = appendParam(url, "$top", p.maxResults);
            }
            if (p.skipToken) {
                url = appendParam(url, "$skipToken", p.skipToken);
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Delete a folder 
		*	@param {string} id Folder id
        *   @param {Boolean} deleteContents true to delete documents in the folder tree.  If false documents are unfiled but not deleted.
        *   @param {bool} [permanent] If true the document will be permanently deleted, rather than being moved to the cabinet's Deleted Items.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function remove(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.deleteContents)
                url = appendParam(url, 'deleteContents', '1');
            if (p.permanent)
                url = appendParam(url, 'permanent', 't');
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Modify folder profile 
		*	@param {string} id Folder id
        *   @param {JSON} info Folder info object. Object should match the one returned from a getInfo call.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            var data = JSON.stringify(p.info);
            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

		/** Modify folder ACL 
		*	@param {string} id Folder id
        *   @param {JSON} acl 
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";

            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }

            var data = JSON.stringify(p.acl);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

		/** Change folder's parent, i.e. move folder 
		*	@param {string} id Folder id
        *   @param {JSON, String} newParent
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putParent(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/parent";
            if (typeof (newParent) != "string")
                newParent = JSON.stringify(p.newParent);
            return api.doAjaxCall(url, api.state.accessToken, p.newParent, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

		/** Create new folder 
        *   @param {string} name name of the new folder
        *   @param {string} parent ID of parent folder or workspace; null for top-level folder
        *   @param {string} cabinet ID of cabinet for top-level folder; ignored if parent is non-null
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function create(p) {
            if (p.name == null || p.name.length < 1) throw "name is required";
            var data = "name=" + encodeURIComponent(p.name);
            if (p.parent != null && p.parent.length > 0)
                data += "&parent=" + encodeURIComponent(p.parent);
            if (p.cabinet != null && p.cabinet.length > 0)
                data += "&cabinet=" + encodeURIComponent(p.cabinet);
            if (p.foldertype != null && p.foldertype.length > 0)
                data += "&foldertype=" + encodeURIComponent(p.foldertype);
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** File items in a folder
		*	@param {string} id Folder id
        *   @param {string, string Array} items - IDs of documents and saved searches to file in the folder
        *   @param {bool} [inheritProfile] indicates whether the filed item should inherit the folder's profile attributes (default is true)
        *   @param {bool} [inheritAcl] indicates whether the filed item should inherit the folder's acl (default is true)
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)		
        */
        function file(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var data = "action=file";
            if (typeof (p.items) == "string")
                data += "&item=" + encodeURIComponent(p.items);
            else {
                for (var i = 0; i < p.items.length; i++)
                    data += "&item=" + encodeURIComponent(p.items[i]);
            }
            if (p.inheritProfile != undefined && !p.inheritProfile) {
                data += "&inheritProfile=" + p.inheritProfile;
            }
            if (p.inheritAcl != undefined && !p.inheritAcl) {
                data += "&inheritAcl=" + p.inheritAcl;
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Unfile items from a folder
		*	@param {string} id Folder id
        *   @param {string, string Array} items - IDs of documents and saved searches to file in the folder
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)	
        */
        function unfile(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var data = "action=unfile";
            if (typeof (p.items) == "string")
                data += "&item=" + encodeURIComponent(p.items);
            else {
                for (var i = 0; i < p.items.length; i++)
                    data += "&item=" + encodeURIComponent(p.items[i]);
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

	    /** convert an existing folder & its items includes subfolders to smart folder.
        *   This will insert a netsage job.
        *	@param {string} id Folder id
        *	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)	
        */
        function convertfolder(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var data = "action=convert";
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

        return {
            getInfo: getInfo,
            getAcl: getAcl,
            getParent: getParent,
            getAncestors: getAncestors,
            getContents: getContents,
            putInfo: putInfo,
            putAcl: putAcl,
            putParent: putParent,
            create: create,
            deleteItem: remove,
            file: file,
            unfile: unfile,
            convert: convertfolder
        }
    })();

	/** 
    *   @class Saved Search APIs 
    *   @example Saved Search IDs take one of the following forms:<br/>
    *       API ID, i.e. :Q12:a:b:c:d:~012110612341234.nev<br/>
    *       12 digit numeric saved search id formatted ####-####-####
    */
    var SavedSearch = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/SavedSearch/"; };

		/** Retrieve saved search profile data 
		*	@param {String} id SavedSearch id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve saved search ACL 
		*	@param {String} id SavedSearch id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve search results 
		*	@param {String} id SavedSearch id
        *	@param {Integer} maxResults The maximum # of results to return from each call.  Can't be over 500. 0 or null to use the default.
        *   @param {String} skipToken null for the initial search.  To retrieve additional results after the first block, pass the skipToken
        *           returned from the previous call.
        *   @param {Boolean} getCount true to return an estimate of the total # of items matching the search
        *	@param {String} extensions - null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.
        *	@param {string} select - null to return id and type, standardAttributes to return all standard attributes or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function doSearch(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.maxResults != null && p.maxResults > 0)
                url = appendParam(url, '$top', p.maxResults);
            if (p.skipToken != null && p.skipToken.length > 0)
                url = appendParam(url, '$skiptoken', p.skipToken);
            if (p.getCount)
                url = appendParam(url, '$inlinecount', 'allpages');
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var r = api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
            if (r != null && r.next != null) {
                var nextPar = parseQuery(r.next);
                r.skipToken = nextPar.$skiptoken;
            }
            return r;
        }

		/** Create a saved search
        *   @param {string} name - name of the new saved search
        *   @param {string} criteria - search criteria
        *   @param {string} cabinet - ID of cabinet where saved search will be created
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function create(p) {
            if (p.name == null || p.name.length < 1) throw "name is required";
            if (p.cabinet == null || p.cabinet.length < 1) throw "cabinet is required";
            if (p.criteria == null || p.criteria.length < 1) throw "criteria are required";
            var data = {};
            data.name = p.name;
            data.cabinet = p.cabinet;
            data.q = p.criteria;
            data.destination = p.destination;
            data.restrictToWorkspace = p.restrictToWorkspace;
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Delete a saved search 			
		*	@param {String} id SavedSearch id
        *   @param {bool} [permanent] If true the document will be permanently deleted, rather than being moved to the cabinet's Deleted Items.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function remove(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.permanent)
                url = appendParam(url, 'permanent', 't');
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Modify saved search ACL        			
		*	@param {String} id SavedSearch id
		*	@param {JSON} acl
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";

            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }

            var data = JSON.stringify(p.acl);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

		/** Modify saved search profile        			
		*	@param {String} id SavedSearch id
		*	@param {JSON} info
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            var data = JSON.stringify(p.info);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

        return {
            getInfo: getInfo,
            getAcl: getAcl,
            performSearch: doSearch,
            create: create,
            deleteItem: remove,
            putAcl: putAcl,
            putInfo: putInfo
        }
    })();

	/** 
    *   @class Filter APIs
    *   @example Filter IDs take one of the following forms:<br/>
    *       API ID, i.e. :Q12:a:b:c:d:~112110612341234.nev<br/>
    *       12 digit numeric filter id formatted ####-####-####
    */
    var Filter = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Filter/"; };

		/** Retrieve filter profile data 		
		*	@param {String} id Filter id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve filter ACL  		
		*	@param {String} id Filter id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve search results 
		*	@param {String} id Filter id
        *	@param {Integer} maxResults The maximum # of results to return from each call.  Can't be over 500. 0 or null to use the default.
        *   @param {String} skipToken null for the initial call.  To retrieve additional results after the first block, pass the skipToken
        *           returned from the previous call.
        *	@param {String} extensions - null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.
        *	@param {string} select - null to return id and type, standardAttributes to return all standard attributes or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function doSearch(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            if (p.maxResults != null && p.maxResults > 0)
                url = appendParam(url, '$top', p.maxResults);
            if (p.skipToken != null && p.skipToken.length > 0)
                url = appendParam(url, '$skiptoken', p.skipToken);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var r = api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
            if (r != null && r.next != null) {
                var nextPar = parseQuery(r.next);
                r.skipToken = nextPar.$skiptoken;
            }
            return r;
        }

		/** Delete a filter  		
		*	@param {String} id Filter id
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function remove(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Modify filter ACL  		
		*	@param {String} id Filter id
		*	@param {JSON} acl
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putAcl(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/acl";

            if (p.extras) {
                url += "?";
                $.each(p.extras, function (i, v) {
                    url += encodeURIComponent(i) + "=" + encodeURIComponent(v) + "&";
                });
                url = url.replace(/\&$/, "");
            }

            var data = JSON.stringify(p.acl);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json' });
        }

		/** File a document in a filter
		*	@param {String} id Filter id
		*   @param {String} item - id of the document to be filed in the workspace
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function file(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id;
            var params = {};
            params.item = p.item;
            params.action = "file";
            return api.doAjaxCall(url, api.state.accessToken, params, p.success, "POST", p.error);
        }

        return {
            getInfo: getInfo,
            getAcl: getAcl,
            performSearch: doSearch,
            deleteItem: remove,
            putAcl: putAcl,
            file: file
        }
    })();

	/** 
    *   @class Search APIs 
    */
    var Search = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Search"; };

		/** Do a search 
		*	@param {String} cabGuid The guid of the cabinet you want to search in.
		*	@param {String} criteria The criteria the search will be based off.
        *	@param {Integer} maxResults The maximum # of results to return from each call.  Can't be over 500. 0 or null to use the default.
        *   @param {String} skipToken null for the initial call.  To retrieve additional results after the first block, pass the skipToken
        *           returned from the previous call.
        *   @param {String} sort "lastMod" to sort by Last Modified, "name" to sort by name/subject, "relevance" or null to sort by relevance.
        *	@param {string} select - null to return id and type, standardAttributes to return all standard attributes
		*   @param {bool} [useMvp] If true the full MVP attribute value will be returned, otherwise - only the primary value.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function doSearch(p) {
            if (p.criteria == undefined && p.servermod == undefined) throw "criteria or servermod is required.";
            var url = apiUrl();
            if (p.cabGuid == undefined) {
                if (p.criteria == undefined || !p.criteria.includes("=10("))
                    throw "cabGuid is required or the criteria must contain an =10() cabinet limiter";
            }
            else url = url + "/" + p.cabGuid;
            if (p.servermod != null)
                url = url + "?servermod=" + encodeURIComponent(p.servermod);
            else
                url = url + "?q=" + encodeURIComponent(p.criteria);
            if (p.maxResults != null && p.maxResults > 0)
                url = appendParam(url, '$top', p.maxResults);
            if (p.skipToken != null && p.skipToken.length > 0)
                url = appendParam(url, '$skiptoken', p.skipToken);
            if (p.sort != null && p.sort.length > 0)
                url = appendParam(url, '$orderby', p.sort);
            if (p.getCount)
                url = appendParam(url, '$inlinecount', 'allpages');
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            if (p.deleted != null && p.deleted.length > 0)
                url = appendParam(url, "deleted", p.deleted);
            if (p.skip != null && p.skip > 0)
                url = appendParam(url, "$skip", p.skip);
            if (p.extraValues != undefined) {
                for (var key in p.extraValues)
                    url = appendParam(url, key, p.extraValues[key]);
            }
            var r = api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
            if (r != null && r.next != null) {
                var nextPar = parseQuery(r.next);
                r.skipToken = nextPar.$skiptoken;
            }
            return r;
        }

		/** Submit a background job to modify the ACLs of all items matching a search
        *   @param {String} cabGuid - The guid of the cabinet you want to search in.
        *   @param {String} criteria - search criteria
        *   @param {String} mode - "add", "replace", or "remove", indicating how the new ACL should be combined with the current ACLs
        *   @param {String} newAcl - The new ACL to be assigned to the matching items
        *   @param {String} email - Email address to receive the results of the background operation
        */
        function massAclChange(p) {
            if (p.cabGuid == null || p.cabGuid.length < 1) throw "cabGuid is required";
            var url = apiUrl() + p.cabGuid;
            delete p.cabGuid;
            if (p.criteria != null && p.criteria.length > 0) {
                p.q = p.criteria;
                delete p.criteria;
            }
            if (p.q == null || p.q.length < 1) throw "criteria are required";
            if (p.mode == null || p.mode.length < 1) throw "mode is required";
            if (typeof (p.completionEmail) == 'string' && p.completionEmail.length > 0)
                p.completionEmail = p.completionEmail;
            if (p.newAcl == null || p.newAcl.length < 1) throw "newAcl is required";
            if (typeof (p.newAcl) == "string")
                p.newAcl = JSON.stringify(JSON.parse(p.newAcl));
            else
                p.newAcl = JSON.stringify(p.newAcl);

            p.action = "changeAcl";
            return api.doAjaxCall(url, api.state.accessToken, p, p.success, "POST", p.error);
        }

		/** Retrieve document(s) visibility
        * @param {string} id Document id (at least one is required)
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getVisibility(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl();
            var data = "action=getvisibility";
            if (p.user != undefined)
                data += "&user=" + p.user;
            if (typeof (p.id) == "string") {
                data += "&id=" + encodeURIComponent(p.id);
            }
            else {
                for (var i = 0; i < p.id.length; i++)
                    data += "&id=" + encodeURIComponent(p.id[i]);
            }
            //	POST instead of a GET so callers can provide long lists of documents.
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

        return {
            performSearch: doSearch,
            getVisibility: getVisibility,
            massAclChange: massAclChange
        }
    })();

	/** 
    *   @class User APIs 
    */
    var User = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/User/"; };
		/** Function that double encodes an parent attribute value that contains chracters reserved for the URL
		*/
        function encodeAttribute(attr) {
            if (typeof attr == "string" && attr.search(/[/\\%\+]/) > -1)
                return encodeURIComponent(encodeURIComponent(attr))
            else
                return encodeURIComponent(attr)
        }

		/** Retrieve common user information 
        *   @param {String} id null for the current user
		*   @param {Object} [extras] Any additional data that needs to be passed to the GET request.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)		
        */
        function getInfo(p) {
            var url = apiUrl();
            if (p.id != null)
                url += p.id + "/";
            url += "info";
            if (p.extras) {
                url += "?";
                for (i in p.extras) {
                    url += i + "=" + p.extras[i] + "&";
                }
                url = url.replace(/\&$/, "");
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

	    /** Retrieve common user information 
        *   @param {String} id null for the current user
		*   @param {Object} [extras] Any additional data that needs to be passed to the GET request.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)		
        */
        function getFedInfo(p) {
            var url = apiUrl();
            if (p.id != null)
                url += p.id + "/";
            url += "fedinfo";
            if (p.extras) {
                url += "?";
                for (i in p.extras) {
                    url += i + "=" + p.extras[i] + "&";
                }
                url = url.replace(/\&$/, "");
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the list of cabinets the current user is a member of 				
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getCabinetList(p) {
            var url = apiUrl() + "cabinets";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the user's Recently Opened Documents list 
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {String} extensions null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.		
		* 	@param {Object} [extras] Any additional parameters that need to be considered.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getRecentlyOpenedDocs(p) {
            var url = apiUrl() + "recentlyOpenedDocs";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            for (i in p.extras) {
                url = appendParam(url, i, p.extras[i]);
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the user's Recently Edited Documents list 
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {String} extensions null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.		
		* 	@param {Object} [extras] Any additional parameters that need to be considered.		
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getRecentlyEditedDocs(p) {
            var url = apiUrl() + "recentlyEditedDocs";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            for (i in p.extras) {
                url = appendParam(url, i, p.extras[i]);
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the user's Recently Added Documents list 
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {String} extensions null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.	
		* 	@param {Object} [extras] Any additional parameters that need to be considered.		
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getRecentlyAddedDocs(p) {
            var url = apiUrl() + "recentlyAddedDocs";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            for (i in p.extras) {
                url = appendParam(url, i, p.extras[i]);
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the user's Recently Accessed list 
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {String} extensions null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.	
		* 	@param {Object} [extras] Any additional parameters that need to be considered.		
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */

        function getRecentlyAccessedDocs(p) {
            var url = apiUrl() + "recentlyAccessedDocs";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            for (i in p.extras) {
                url = appendParam(url, i, p.extras[i]);
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the user's ND home page content 
        *	@param {string} select - null to return id and type, standardAttributes to return all standard attributes, or a comma-separated 
		*	list of attribute numbers to return those custom attributes along with the standard attributes.
		*	@param {String} extensions null to return all results or a comma-separated
        *       list of file extensions to only return contents with matching extensions.		
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getHomePage(p) {
            var url = apiUrl() + "homePage";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            var filterList = buildExtensionFilter(p.extensions);
            if (filterList.length > 0)
                url = appendParam(url, '$filter', filterList);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the list of groups the current user is a member of 
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getGroups(p) {
            var url = apiUrl();
            if (p.user != null && p.user.length > 0) {
                url += p.user;
                url += "/groups"
            } else {
                url += "groups";
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the current user's favorite workspaces list 
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes
        *	@param {string} filter "cabinet eq cabinetId" to restrict to only return workspaces in a particular cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getFavoriteWorkspaces(p) {
            var url = apiUrl() + "wsFav";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            if (p.filter != null && p.filter.length > 0)
                url = appendParam(url, "$filter", p.filter);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the current user's recent workspaces list 
        *	@param {string} select - null to return id and type, standardAttributes to return all standard attributes
        *	@param {string} filter - "cabinet eq cabinetId" to restrict to only return workspaces in a particular cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getRecentWorkspaces(p) {
            var url = apiUrl() + "wsRecent";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            if (p.filter != null && p.filter.length > 0)
                url = appendParam(url, "$filter", p.filter);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/**	Deletes the pvCache for the for the given attribute value.
		*	@param {string} repository The id of the repository the attribute belongs to.
		*	@param {integer} field The id of attribute.
		*	@param {string} [parentVal] The value of the attributes parent, if there is one.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function clearPvCache(p) {
            var url = apiUrl();
            if (p.repository == undefined) {
                throw "repository id is required";
            }
            url += p.repository + "/";
            if (p.field == undefined) {
                throw "field id is required";
            }
            url += p.field + "/";
            if (p.parentVal) {
                url += encodeAttribute(p.parentVal) + "/";
            }
            url += "cache";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Create a user
		*	@param {String} username The username of the new user
		*	@param {String} displayName	The full display name of the user. ("Jane Q Doe")
		*	@param {String} emailAddress The email address of the new user
		*	@param {String} repositoryID ID of the Repository
		*	@param {function} [success] Called on success. Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when an error occurs. Signature function(jqXHR, textStatus, errorThrown)
		*/
        function createUser(p) {
            if (p.username === undefined) throw "username is required.";
            if (p.displayName === undefined && p.firstname === undefined && p.lastname === undefined && p.middlename === undefined) throw "displayName is required.";
            if (p.email === undefined) throw "email is required.";
            if (p.repository === undefined) throw "repository is required.";
            var url = apiUrl();
            var data = { username: p.username, displayName: p.displayName, email: p.email, repository: p.repository };
            if (p.firstname !== undefined) {
                data["displayFirstName"] = p.firstname;
            }
            if (p.lastname !== undefined) {
                data["displayLastName"] = p.lastname;
            }
            if (p.middlename !== undefined) {
                data["displayMiddleName"] = p.middlename;
            }
            if (p.external !== undefined) {
                data["external"] = p.external;
            }
            if (p.sendWelcome !== undefined) {
                data["sendWelcome"] = p.sendWelcome;
            }

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }
        return {
            getInfo: getInfo,
            getFedInfo: getFedInfo,
            getCabinets: getCabinetList,
            getRecentlyOpenedDocs: getRecentlyOpenedDocs,
            getRecentlyEditedDocs: getRecentlyEditedDocs,
            getRecentlyAddedDocs: getRecentlyAddedDocs,
            getRecentlyAccessedDocs: getRecentlyAccessedDocs,
            getHomePage: getHomePage,
            getGroups: getGroups,
            getFavoriteWorkspaces: getFavoriteWorkspaces,
            getRecentWorkspaces: getRecentWorkspaces,
            clearPvCache: clearPvCache,
            createUser: createUser
        }

    })();

	/** 
    *   @class Repository APIs 
    */
    var Repository = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Repository/"; };

		/** Retrieve common repository information
		*   @param {String} id id of the Repository
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve user groups that belong in the repository.
		*   @param {String} id id of the Repository
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getGroups(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/groups";
            var data = {
                "$top": p.$top,
                "$filter": p.$filter,
                "paging": p.paging,
                "$skiptoken": p.$skiptoken
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "GET", p.error);
        }

		/** Retrieve list of users that are members of the repository.
		*   @param {String} id id of the Repository
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getUsers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/users";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Request that a consolidated activity log be mailed
		*   @param {String} id - id of the Repository
        *   @param {String} email - email address the log should be sent to
        *   @param {String} start - start date for log records in YYYY-MM-DD format
        *   @param {String} end - end date for log records in YYYY-MM-DD format
        *   @param {String} logtype - logType a value of 'Consolidated' or '0' is for accessing the consolidated Logs while a value of 'Admin' or '1' for Repository admin logs, the default is a value of 'Consolidated'
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function emailLog(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/sendLog";
            return api.doAjaxCall(url, api.state.accessToken, p, p.success, "POST", p.error);
        }

		/** Download consolidated activity log
		*   @param {String} id - id of the Repository
        *   @param {String} start - start date for log records in YYYY-MM-DD format
        *   @param {String} end - end date for log records in YYYY-MM-DD format
        *   @param {String} logtype - logType a value of 'Consolidated' or '0' is for accessing the consolidated Logs while a value of 'Admin' or '1' for Repository admin logs, the default is a value of 'Consolidated'
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function downloadLog(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/log";
            return api.doAjaxCall(url, api.state.accessToken, p, p.success, "GET", p.error, { dataType: "xml", accepts: { xml: "application/json, application/xml, text/xml" } });
        }


		/** Create a user group
		*   @param {String} id id of the Repository
		*	@param {String} name The name of the new group you are creating.
		*   @param {Boolean} [external] True if the group is an external group.  Default is false.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postGroup(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.name == undefined) throw "group name is required.";
            var url = apiUrl() + p.id + "/group";
            var data = { name: p.name };
            if (p.external) {
                data["external"] = p.external;
            }
            if (p.hideMembership) {
                data["hideMembership"] = p.hideMembership;
            }
            if (p.hidden) {
                data["hidden"] = p.hidden;
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Delete a user group.
		*   @param {String} id ID of the Repository
		*   @param {String} groupID The guid of the group you want to delete.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function deleteGroup(p) {
            if (p.id == undefined) throw "id is required.";
            if (p.groupID == undefined) throw "group ID is required.";
            var url = apiUrl() + p.id + "/group/" + p.groupID;
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Add a user to a repository
		*	@param {String} id The id of the repository
		*	@param {String} members A comma separated list of guids of the users you want to add.
		*	@param {Boolean} [external] True if the member(s) are to be added as External users. Default is False.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function addMembers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/members";
            var data = {
                member: p.members,
                action: "add"
            };
            if (p.external) {
                data["external"] = p.external;
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/**	Remove a user from a repository
        *   @param {String} id The id of the repository
		*	@param {String} members A comma separated list of guids of the users you want to remove.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function removeMembers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/members";
            var data = {
                member: p.members,
                action: "remove"
            };
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }


        return {
            getInfo: getInfo,
            getGroups: getGroups,
            getUsers: getUsers,
            emailLog: emailLog,
            downloadLog: downloadLog,
            postGroup: postGroup,
            deleteGroup: deleteGroup,
            removeMembers: removeMembers,
            addMembers: addMembers
        }
    })();

	/** 
    *   @class Cabinet APIs 
    */
    var Cabinet = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Cabinet/"; };

		/** Retrieve common cabinet information
		*   @param {String} id The id of the Cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getInfo(p) {
            if (p.id == undefined) throw "id is required";
            var url = apiUrl() + p.id + "/info";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve custom attributes definitions for this cabinet
		*   @param {String} id The id of the Cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getCustomAttributes(p) {
            if (p.id == undefined) throw "id is required";
            var url = apiUrl() + p.id + "/customAttributes";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve top-level folders
		*   @param {String} id The id of the Cabinet
        *	@param {string} select null to return id and type, standardAttributes to return all standard attributes
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getFolders(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/folders";
            if (p.select != null && p.select.length > 0)
                url = appendParam(url, "$select", p.select);
            if (p.orderby != null && p.orderby.length > 0)
                url = appendParam(url, "$orderby", p.orderby);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve cabinet settings
		*   @param {String} id The id of the Cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getSettings(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/settings";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the current user's security templates for this cabinet
        *   @param {String} id The id of the cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getSecurityTemplates(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/securityTemplates";
            if (p.bypasscache) {
                if (url.indexOf("?") > 0)
                    url += "&bypasscache=" + p.bypasscache;
                else
                    url += "?bypasscache=" + p.bypasscache;
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }
		/** Retrieve the current user's profile templates for this cabinet
        *   @param {String} id The id of the cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getProfileTemplates(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/profileTemplates";
            if (p.bypasscache) {
                if (url.indexOf("?") > 0)
                    url += "&bypasscache=" + p.bypasscache;
                else
                    url += "?bypasscache=" + p.bypasscache;
            }
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Retrieve the cabinets default access list
		*   @param {String} id The id of the cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getMembership(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/membership";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

	    /** Retrieve user groups active in the cabinet.
		*   @param {String} id id of the cabinet
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getGroups(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/groups";
            var data = {
                "$top": p.$top,
                "$filter": p.$filter
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "GET", p.error);
        }

	    /** Add a group to the cabinets membership list
		*   @param {String} id The id of the cabinet
		*	@param {String} groupId The id of the group you are adding to the membership list
		*	@param {Boolean} [view] True if the members of the user group will have view rights
		*	@param {Boolean} [edit] True if the members of the user group will have edit rights
		*	@param {Boolean} [share] True if the members of the user group will have share rights
		*	@param {Boolean} [administer] True if the members of the user group will have administration rights
		*	@param {Boolean} [onAccess] True if the members of the user group will have no access rights
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function addMember(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/membership";
            var data = {
                action: "add",
                id: p.groupId,
                view: p.view,
                edit: p.edit,
                share: p.share,
                administer: p.administer,
                noAccess: p.noAccess
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Remove a group from the cabinets membership list
		*   @param {String} id The id of the cabinet
		*	@param {String} groupId The id of the group you are adding to the membership list
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
		*	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function removeMember(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/membership";
            var data = {
                action: "remove",
                id: p.groupId
            }
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

        return {
            getInfo: getInfo,
            getCustomAttributes: getCustomAttributes,
            getFolders: getFolders,
            getSettings: getSettings,
            getSecurityTemplates: getSecurityTemplates,
            getProfileTemplates: getProfileTemplates,
            getMembership: getMembership,
            getGroups: getGroups,
            addMember: addMember,
            removeMember: removeMember
        }
    })();

	/** 
    *   @class User Group APIs     
    */
    var Group = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Group/"; };

		/** Retrieve common group information 
        *   @param {String} id The id of the group
		*	@param {bool} cabMemberShip If true, include the cabinet membership information for each group (default is false)
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            var data = {};
            if (p.cabMemberShip)
                data.cabMemberShip = p.cabMemberShip;

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "GET", p.error);
        }

		/** Retrieve group membership list 
        *   @param {String} id The id of the group
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function getMembers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/members";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/**	Add a user from a group
        *   @param {String} id The id of the group
		*	@param {String} members A comma separated list of guids of the users you want to add to the group.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function postMembers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/members";
            var data = {
                member: p.members,
                action: "add"
            };
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/**	Remove a user from a group
        *   @param {String} id The id of the group
		*	@param {String} members A comma separated list of guids of the users you want to remove.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function removeMembers(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/members";
            var data = {
                member: p.members,
                action: "remove"
            };
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/**	Update the attributes of a group
		*	@param {String} id Group id
		*	@param {JSON} info
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
		*/
        function putInfo(p) {
            if (p.id == undefined) throw "id is required.";
            var url = apiUrl() + p.id + "/info";
            var data = JSON.stringify(p.info);
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "PUT", p.error, { contentType: 'application/json', dataType: "text" });
        }

        return {
            getInfo: getInfo,
            getMembers: getMembers,
            postMembers: postMembers,
            removeMembers: removeMembers,
            putInfo: putInfo
        }
    })();

	/** 
    *   @class Lookup Table APIs 
    */
    var Attribute = (function () {
		/**	@private
		*/
        function encodeAttribute(attr) {
            if (typeof attr == "string" && attr.search(/[/\\%\+]/) > -1)
                return encodeURIComponent(encodeURIComponent(attr))
            else
                return encodeURIComponent(attr)
        }

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/Attributes/"; };


		/** Add Or Update Recent (also called <b>addOrUpdateRecent</b>) 
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {string} key key.
        * @param {Integer} [parentAttrNum] field value.
        * @param {string} [parentKey] parent key value.
        * @param {string} repository repository guid.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {string} updateMode Must be set to "recent".  
        * @param {Integer} attrNum field value.
        */
        function addOrUpdateRecent(p) {
            var errorMsgPrefix = "Error while adding to recently selected: \n";
            if (p.updateMode == undefined || p.updateMode === "") throw errorMsgPrefix + "No updateMode provided.";
            if (p.repository == undefined || p.repository === "") throw errorMsgPrefix + "No repository guid provided.";
            if (p.key == undefined || p.key === "") throw errorMsgPrefix + "No key provided.";
            if (p.attrNum == undefined || p.attrNum === "") throw errorMsgPrefix + "No attrNum provided.";
            p.parentAttrNum = p.parentAttrNum || "";
            p.parentKey = p.parentKey || "";

            var url = apiUrl() + p.repository;
            var data = {};
            data.updateMode = p.updateMode;
            data.key = p.key;
            data.attrNum = p.attrNum;
            data.parentAttrNum = p.parentAttrNum;
            data.parentKey = p.parentKey;

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Get the lookup data information for a single or multiple keys.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup item's key
        * @param {String} [parent] Lookup item's parent
        * @param {String} [filter] What to filter results by.  Currently needs to be 
            startswith(key|description|both, prefix) or substringof(substring, key|description)
            if you need to have a comma in the prefix or substring enclose in ""
        * @param {String} [select] Comma separated list of fields to return on each item
        * @param {int} [skip] Skip this number of entries
        * @param {int} [top] How many entries to return
        * @param {String} [orderby] Either key or parent
        * @param {String} [count] One of three values: 'no' - does not show the count, 'also' - shows the count along with the rows, 'only' - shows only the count.
		* @param {Boolean} [setLookupDefault] If true, key|description will be set as the users default lookup option.
		* @param {Boolean} [setOrderbyDefault] If true, key|description will be set as the users default orderby option.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getAttributes(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.field == undefined) throw "field is required.";
            var url = apiUrl() + p.repository + "/" + p.field;
            if (p.parent != undefined && p.parent.length > 0) url += "/" + encodeAttribute(p.parent);
            if (p.key != undefined && p.key.length > 0) url += "/" + encodeAttribute(p.key);
            if (p.count != undefined && p.count == 'only') url += "/$count";
            if (p.select || p.skip || p.top || p.filter || p.count == "also" || p.setLookupDefault || p.setOrderbyDefault) url += "?";
            if (p.filter != undefined && p.filter.length > 0) url += "$filter=" + encodeURIComponent(p.filter) + "&";
            if (p.orderby != undefined && p.orderby.length > 0) url += "$orderby=" + encodeAttribute(p.orderby) + "&";
            if (p.select != undefined && p.select.length > 0) url += "$select=" + encodeAttribute(p.select) + "&";
            if (p.skip != undefined && p.skip > 0) url += "$skip=" + encodeAttribute(p.skip) + "&";
            if (p.top != undefined && p.top > 0) url += "$top=" + encodeAttribute(p.top) + "&";
            if (p.count != undefined && p.count == 'also') url += "$inlinecount=allpages&";
            if (p.setLookupDefault) { url += "setLookupDefault=" + p.setLookupDefault; }
            if (p.setOrderbyDefault) { url += "setOrderbyDefault=" + p.setOrderbyDefault; }
            url = url.replace(/&$/, ''); //remove any ending &
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Get the lookup data information for a single or multiple keys.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup child field id
        * @param {String} [select] Comma separated list of fields to return on each item
        * @param {int} [skipToken] Paging token. If there are more results in the set than can be returned in the first block, a skiptoken is sent along with the results.  This skiptoken can be sent on a subsequent call to retrieve the next page of results.
        * @param {int} [top] How many entries to return
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getParentChildAttributes(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.field == undefined) throw "field is required.";
            var url = apiUrl() + p.repository + "/all/" + p.field;
            if (p.select || p.skiptoken || p.top) url += "?";
            if (p.select != undefined && p.select.length > 0) url += "$select=" + encodeAttribute(p.select) + "&";
            if (p.skiptoken != undefined && p.skiptoken > 0) url += "$skiptoken=" + encodeAttribute(p.skiptoken) + "&";
            if (p.top != undefined && p.top > 0) url += "$top=" + encodeAttribute(p.top) + "&";
            url = url.replace(/&$/, ''); //remove any ending &
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Put a new lookup attribute into the table or alter an existing one.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {object} [data] Lookup item data.  Formatted the same as objects returned from a get.
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function putAttribute(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.field == undefined) throw "field is required.";
            if (p.data == undefined) p.data = {};
            var url = apiUrl() + p.repository + "/" + p.field;
            if (p.parent != undefined && p.parent.length > 0) url += "/" + encodeAttribute(p.parent);
            if (p.key != undefined && p.key.length > 0) url += "/" + encodeAttribute(p.key);
            if ($.type(p.data) != "string") p.data = JSON.stringify(p.data);
            return api.doAjaxCall(url, api.state.accessToken, p.data, p.success, "PUT", p.error);
        }

		/** Put an existing lookup attribute.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function deleteAttribute(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.field == undefined) throw "field is required.";
            var url = apiUrl() + p.repository + "/" + p.field;
            if (p.parent != undefined && p.parent.length > 0) url += "/" + encodeAttribute(p.parent);
            if (p.key != undefined && p.key.length > 0) url += "/" + encodeAttribute(p.key);
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Upload a lookup table to an existing attribute.
		 * @param {String} repository The repository/account GUID
		 * @param {String} emailAddress The email address where notifications can be sent to.
		 * @param {String} updateMode The type of update desired. (Add/Replace/Remove)
		 * @param {String} tableData The table data to be uploaded
		 * @param {Boolean} [completionEmail] Indicates if upon completion of the upload task, a message should be sent to the address specified in the "emailAddress".
		 * @param {String} field The lookup field id.
		 */
        function uploadTable(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.emailAddress == undefined) throw "emailAddress is required.";
            if (p.updateMode == undefined) throw "updateMode is required.";
            if (p.tableData == undefined) throw "tableData is required.";
            if (p.completionEmail == undefined) p.completionEmail = true;
            //			var url = apiUrl() + p.repository;
            //			var data = { emailAddress: p.emailAddress, updateMode: p.updateMode, tableData: p.tableData, emailCompletion: p.emailCompletion };
            //
            //			return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);

            var data = new FormData();
            data.append("emailAddress", p.emailAddress);
            data.append("updateMode", p.updateMode);
            data.append("completionEmail", p.completionEmail);
            data.append("tableData", p.tableData);

            var url = apiUrl() + p.repository;
            return api.doAjaxCall(
                url,
                api.state.accessToken,
                data,
                p.success,
                "POST",
                p.error,
                {
                    processData: false,
                    contentType: false,//"multipart/form-data",
                    //mimeType: "multipart/form-data"
                });
        }

        /** Encryption Key Management Functions */
        /** signature e.g. "attributes/{repositoryId}/{field}/{*attrsString}/encryptionKey(s)/{keyId}" */


        function getCommonUrlParams(p) {
            if (p.repository == undefined) throw "repository is required.";
            if (p.field == undefined) throw "field is required.";
            var url = apiUrl() + p.repository + "/" + p.field;
            if (p.parent != undefined && p.parent.length > 0) url += "/" + encodeAttribute(p.parent);
            if (p.key != undefined && p.key.length > 0) url += "/" + encodeAttribute(p.key);
            return url;
        }


		/** Get list of all encryption keys for an attribute.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function listAttrEncKeys(p) {

            var url = getCommonUrlParams(p);
            url += "/encryptionKeys";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Gets an existing specific encryption key.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [keyId] encryption key id
        */
        function getEncKey(p) {

            var url = getCommonUrlParams(p);
            if (p.keyId == undefined) throw "keyId is required.";
            url += "/encryptionKey/" + encodeAttribute(p.keyId);

            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "text", accepts: { text: "application/json, text/plain" } });
        }

		/** Deletes an existing encryption key.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [keyId] encryption key id
        */
        function deleteEncKey(p) {

            var url = getCommonUrlParams(p);
            if (p.keyId == undefined) throw "keyId is required.";
            url += "/encryptionKey/" + encodeAttribute(p.keyId);

            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "DELETE", p.error);
        }

		/** Restores an existing encryption key.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [keyId] encryption key id
        * @param {String} [keyFile] encryption key file
        */
        function restoreEncKey(p) {

            var url = getCommonUrlParams(p);
            if (p.keyId == undefined) throw "keyId is required.";
            if (p.keyFile == undefined) throw "keyFile is required.";
            url += "/encryptionKey/" + encodeAttribute(p.keyId);

            return api.doAjaxCall(url, api.state.accessToken, p.keyFile, p.success, "PUT", p.error);
        }

	    /** Creates a new encryption key on the hsm of the external hsmId.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [hsmId] hardware storage module id, "ndHSM" for netDocuments hosted, or of form "XXXXXXXX-XXXX" for customer hosted
        */
        function createEncKey(p) {

            var url = getCommonUrlParams(p);
            url += "/encryptionKeys";

            if (p.hsmId == undefined) throw "hsmId is required.";
            var data = { action: "createKey", hsmId: p.hsmId };

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Creates a new encryption key on the hsm of the the provided hsmId.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [hsmId] hardware storage module id, "ndHSM" for netDocuments hosted, or of form "XXXXXXXX-XXXX" for customer hosted
        */
        function createNdHsmEncKey(p) {

            var url = getCommonUrlParams(p);

            if (p.hsmId == undefined) throw "hsmId is required.";
            url += "/createNdHsmEncKey";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error, { dataType: "text", accepts: { text: "application/json, text/plain" } });
        }

	    /** Creates a new encryption key on the hsm of the internal hsmId.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [hsmId] hardware storage module id, "ndHSM" for netDocuments hosted, or of form "XXXXXXXX-XXXX" for customer hosted
        */
        function activateEncKey(p) {

            var url = getCommonUrlParams(p);

            if (p.keyId == undefined) throw "keyId is required.";
            if (p.hsmId == undefined) throw "hsmId is required.";
            url += "/encryptionKey/" + encodeAttribute(p.keyId);
            var data = { action: "ActivateKey", hsmId: p.hsmId, keyId: p.keyId };

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

		/** Activate or deactivate encryption for the encryption key provided.
        * @param {String} repository The repository/account GUID
        * @param {int} field Lookup field id
        * @param {String} key Lookup items key
        * @param {String} [parent] Lookup items parent
        * @param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        * @param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        * @param {String} [keyId] encryption key id
        * @param {String} [action] reactivate or deactivate
        */
        function reactDeactEncKey(p) {

            var url = getCommonUrlParams(p);
            if (p.keyId == undefined) throw "keyId is required.";
            url += "/encryptionKey/" + encodeAttribute(p.keyId);

            if (p.action == undefined) throw "action is required (reactivate or deactivate).";
            var data = { action: p.actionType };

            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

        return {
            addOrUpdateRecent: addOrUpdateRecent,
            getParentChildAttributes: getParentChildAttributes,
            getAttributes: getAttributes,
            get: getAttributes,
            put: putAttribute,
            deleteItem: deleteAttribute,
            uploadTable: uploadTable,
            listAttrEncKeys: listAttrEncKeys,
            getEncKey: getEncKey,
            deleteEncKey: deleteEncKey,
            restoreEncKey: restoreEncKey,
            createEncKey: createEncKey,
            reactDeactEncKey: reactDeactEncKey,
            activateEncKey: activateEncKey,
            createNdHsmEncKey: createNdHsmEncKey
        };
    })();

	/** 
    *   @class System APIs 
    */
    var System = (function () {

        /**	@private	*/
        var apiUrl = function () { return api.state.baseUrl + "/v1/System/"; };

		/** Retrieve system information 
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function getInfo(p) {
            var url = apiUrl() + "/info";
            return api.doAjaxCall(url, api.state.accessToken, null, p.success, "GET", p.error);
        }

		/** Saves a pending actions list to the global cache. 
		*	@private
		*	@param {Array} action Array of actions to send to the chunnel. (Example: [<action1, action2, etc])
		*	@param {String} compID The computer ID of the caller
		*/
        function setPendingActions(p) {
            var url = apiUrl() + "chunnel/pending";
            var data = {};
            data.action = p.action;
            data.compID = p.compID;
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "POST", p.error);
        }

        return {
            getInfo: getInfo,
            setPendingActions: setPendingActions
        };

    })();

	/**#@+
	*	@private
	*/

	/**	This is an undocumented class added for the sync 
    */
    var Sync = (function () {
        var apiUrl = function () { return api.state.baseUrl + "/v1/Sync/"; };

		/** Retrieve list of files and folders to be synced 
        *   @param {} replica The replica ID
		*   @param {} [container] Restrict chages to this container
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function get(p) {
            if (p.replica == undefined) throw "replica is required";
            var url = apiUrl() + p.replica;
            if (p.container != null && p.container.length > 0) url += "/" + p.container;
            var data = null;
            if (p.query != null) data = p.query;
            return api.doAjaxCall(url, api.state.accessToken, data, p.success, "GET", p.error);
        }

		/** Retrieve a new replica ID
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function replicaID(p) {
            return api.doAjaxCall(apiUrl(), api.state.accessToken, { "action": "createReplica" }, p.success, "POST", p.error);
        }

		/** Add a new container to the users sync list
        *   @param {} container
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function addSyncContainer(p) {
            return api.doAjaxCall(apiUrl(), api.state.accessToken, { "action": "addContainer", "container": p.container }, p.success, "POST", p.error);
        }

		/** Remove a container from the users sync list
        *   @param {} container
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function removeSyncContainer(p) {
            return api.doAjaxCall(apiUrl(), api.state.accessToken, { "action": "removeContainer", "container": p.container }, p.success, "POST", p.error);
        }

		/** List the users synced containers
		*   @param {boolean} [all] Should child containers be listed as well?
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function listSyncContainers(p) {
            if (p == undefined) p = { all: "f" };
            else if (p.all == undefined || !p.all) p.all = "f";
            else p.all = "t";
            return api.doAjaxCall(apiUrl(), api.state.accessToken, { "action": "listContainers", "all": p.all }, p.success, "POST", p.error);
        }

		/** Confirm successful completion or storage of sync commands
        *   @param {} replica Replica ID
		*   @param {} container Env url of container
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function confirmSync(p) {
            var data = { "action": "changelistConfirmed", "id": p.replica };
            if (p.container != null && p.container.length > 0) data['container'] = p.container;
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error, { dataType: "text" });
        }

		/** Register a device
        *   @param {String} replica Replica ID
		*   @param {String} name Name of device
		*   @param {String} version Software version
		*   @param {String} device Type of device
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function register(p) {
            var data = {
                "action": "register",
                "id": p.replica,
                "name": p.name,
                "version": p.version,
                "device": p.device
            };
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error, { dataType: "text" });
        }

		/** Update replica information
        *   @param {String} replica Replica ID
		*   @param {String} name Name of device
		*   @param {String} version Software version
		*   @param {String} device Type of device
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function update(p) {
            var data = {
                "action": "update",
                "id": p.replica,
                "name": p.name,
                "version": p.version,
                "device": p.device
            };
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error, { dataType: "text" });
        }

		/** Confirm new documents without downloading
		*   @param {String} id Replica ID
		*   @param {String} container EnvID of container
		*   @param {String} document Comma separated list of document EnvIDs.
		*	@param {function} [success] Called on success.  Signature function(data, textStatus, jqXHR)
        *	@param {function} [error] Called when error occurs.  Signature function(jqXHR, textStatus, errorThrown)
        */
        function confirmNew(p) {
            var data = {
                "action": "confirmNew",
                "id": p.replica,
                "container": p.container,
                "document": p.document
            };
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error, { dataType: "text" });
        }

        return {
            get: get,
            replicaID: replicaID,
            addContainer: addSyncContainer,
            removeContainer: removeSyncContainer,
            listContainers: listSyncContainers,
            confirm: confirmSync,
            register: register,
            update: update,
            confirmNew: confirmNew
        };
    })();

	/**
	*	@class Google controller API
	*/
    var Google = (function () {
        var apiUrl = function () { return api.state.baseUrl + "/v1/Google/"; };
        function importEmail(p) {
            var data = { action: "importemail" };
            if (p.id) data.id = p.id;
            if (p.to) data.to = p.to;
            if (p.from) data.from = p.from;
            if (p.subject) data.subject = p.subject;
            if (p.sent) data.sent = p.sent;
            if (p.destination) data.destination = p.destination;
            if (p.cabinet) data.cabinet = p.cabinet;
            if (p.partialProfiling) data.partialProfiling = p.partialProfiling;
            return api.doAjaxCall(apiUrl(), api.state.accessToken, data, p.success, "POST", p.error);
        }
        return {
            importEmail: importEmail
        };
    })();

    /**#@-*/

    /** The objects added into the api object form the publicly exposed */
    $.extend(library, api, {
        document: Document,
        workspace: Workspace,
        folder: Folder,
        search: Search,
        savedSearch: SavedSearch,
        filter: Filter,
        user: User,
        group: Group,
        cabinet: Cabinet,
        repository: Repository,
        attributes: Attribute,
        system: System,
        sync: Sync,
        google: Google,
        // Helper functions
        createAccessEntry: createAccessEntry,
        getPrevSyncStatus: prevSyncStatus,
        setAccessToken: setAccessToken,
        init: init
    });

	/** Initializes the NetDocuments REST API library by providing a base Url and access token.
	*   @param {String} baseUrl
	*   @param {String} accessToken The oAuth given access token. 
	*/
    function init(baseUrl, accessToken) {
        api.state.baseUrl = baseUrl;
        api.state.accessToken = accessToken;
        return library;
    }

    /** Adds the ability to do String.format('{0} is here, and {1} is here {0} {2}', 'string1', 'string2');*/
    if (!String.format) {
        String.format = function (format) {
            var args = Array.prototype.slice.call(arguments, 1);
            return format.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined'
                    ? args[number]
                    : match
                    ;
            });
        };
    }


    return library;
})(API || {});

/** Call to support deprecated method of creating the ndRestAPI library.
*   @param {String} baseUrl
*   @param {String} accessToken The oAuth given access token. 
*/
function NetDocs(baseUrl, accessToken) {
    return API.init(baseUrl, accessToken);
}