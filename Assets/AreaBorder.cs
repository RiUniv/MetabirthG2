using UnityEngine;
using TMPro; // TextMeshProを使うために必要

public class AreaBorder : MonoBehaviour
{
    // インスペクターからステップ1で作ったWarningTextを紐付けます
    [SerializeField] private GameObject warningText;
    
    // 表示しておく時間（秒）
    [SerializeField] private float displayDuration = 2.0f;

    private float timer = 0f;
    private bool isDisplaying = false;

    void Update()
    {
        // 警告が表示されている間はタイマーを進める
        if (isDisplaying)
        {
            timer -= Time.deltaTime;
            if (timer <= 0f)
            {
                // 時間が経ったら文字を消す
                warningText.SetActive(false);
                isDisplaying = false;
            }
        }
    }

    // プレイヤーが透明な壁（トリガー）に触れた瞬間に呼ばれる
    private void OnTriggerEnter(Collider other)
    {
        // ぶつかってきたオブジェクトが「Player」というタグを持っているか確認
        if (other.CompareTag("Player"))
        {
            // 文字を表示する
            warningText.SetActive(true);
            
            // タイマーをリセットしてカウントダウン開始
            timer = displayDuration;
            isDisplaying = true;
        }
    }
}