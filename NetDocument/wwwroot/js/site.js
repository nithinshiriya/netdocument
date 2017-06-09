// Write your Javascript code.
$("#message").hide();

$("#cabinet").click(function () {  
    var token = $("#token").val();
    console.info("Token: "  + token);

    console.log("Calling API.Init");
    var netDocumentAPI = API.init('https://vault.netvoyage.com', token);       
    console.log("API.Init success");

    console.log("calling get cabinet....");
    try {
        var cabinets = netDocumentAPI.user.getCabinets(cabinetsRec, cabinetsError);
    } catch (err) {
        $("#message").addClass("alert-danger");
        $("#message").html(err + " : Look for more error information in browser console.");
        $("#message").show();
    }

})

function cabinetsRec(data) {  
    $("#message").addClass("alert-success");
    console.log("Cabinet call success");
    $("#message").html("Success");
    $("#message").show();
    console.log(data);
}

function cabinetsError(error) {
    alert("called");
    $("#message").addClass("alert-danger");
    console.error(error);
    $("#message").html("error");
    $("#message").show();
    
}