const maxDistance = 30;
const Damage = 10;

$.onStart(() => {
    $.state.Bullets = 10;
    $.state.maxBullets = 20;
    $.setStateCompat("owner","RemainBullets",$.state.Bullets);
});

$.onUse(isDown => {
  if (!isDown) return;
  if ($.state.Bullets > 0) Shoot();
  else {
    $.sendSignalCompat("this","ReloadStart");
    $.state.Bullets = $.state.maxBullets;
  } 
});

function Shoot(){
  let bullets = $.state.Bullets
  let position = $.getPosition();
  let direction = new Vector3(0, 0, 1).applyQuaternion($.getRotation());
  let raycastResult = $.raycast(position, direction, maxDistance);

  bullets--;
  $.state.Bullets= bullets;
  $.setStateCompat("owner","RemainBullets",bullets);
  $.sendSignalCompat("this","Shoot");
  
  // 直線上に何も見つからなかった場合
  if (raycastResult == null) {
	return;
}

  let handle = raycastResult.handle;
  if(handle == null) return;

  if (handle.type == "player") {
		$.sendSignalCompat("this","Hit");
		handle.send("damage", { value: Damage , attacker: $.getOwner()});
		return;
   }
}